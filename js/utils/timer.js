import { FSM } from './fsm.js';
import { createEnum } from './enum.js';
import { map } from './util.js';
// 타이머 상태를 위한 Enum 정의
export const TimerState = createEnum('TimerState', {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed'
});

// 타이머 액션을 위한 Enum 정의
export const TimerAction = createEnum('TimerAction', {
  START: 'start',
  PAUSE: 'pause',
  RESUME: 'resume',
  RESET: 'reset',
  COMPLETE: 'complete'
});

/**
 * Timer 클래스
 * setTimeout의 확장 버전으로, 일시 정지/재개 기능과 다양한 이벤트 리스너를 지원합니다.
 */
export class Timer {
  /**
   * Timer 생성자
   * @param {Function} callback - 타이머 종료 시 실행할 콜백 함수
   * @param {number} delay - 타이머 지연 시간 (밀리초)
   */
  constructor(callback, delay) {
    // 기본 속성 설정
    this.callback = callback;
    this.initialDelay = delay;
    this.remaining = delay;
    
    // 상태 관리 변수
    this.timerId = null;
    this.startTime = null;
    
    // FSM 초기화 - 상태 전이 모델 정의
    
    this.fsm = FSM.simple(
      map()
      .add(TimerState.IDLE, map()
        .add(TimerAction.START, TimerState.RUNNING)
      )
      .add(TimerState.RUNNING, map()
        .add(TimerAction.PAUSE, TimerState.PAUSED)
        .add(TimerAction.COMPLETE, TimerState.COMPLETED)
        .add(TimerAction.RESET, TimerState.IDLE)
      )
      .add(TimerState.PAUSED, map()
        .add(TimerAction.RESUME, TimerState.RUNNING)
        .add(TimerAction.RESET, TimerState.IDLE)
      )
      .add(TimerState.COMPLETED, map()
        .add(TimerAction.RESET, TimerState.IDLE)
      )
      .build()
    );
    
    // FSM 상태 변경 리스너 설정
    this.fsm.onTransition((from, action, to) => {
      this.listeners[action].forEach(callback => callback(from, action, to));
    });
    
    // 이벤트 리스너
    this.listeners = Object.fromEntries(TimerAction.values().map(action => [action, []]));
  }

  get state() {
    return this.fsm.currentState.value;
  }

  /**
   * 타이머 시작
   * @returns {boolean} 타이머 시작 성공 여부
   */
  start() {
    if (!this.fsm.executeAction(TimerAction.START)) {
        return false;
    }
    
    this.startTime = Date.now();
    this.timerId = setTimeout(() => this.#complete(), this.remaining);
    
    return true;
  }

  /**
   * 타이머 일시 정지
   * @returns {boolean} 타이머 일시 정지 성공 여부
   */
  pause() {
    if (!this.fsm.executeAction(TimerAction.PAUSE)) {
        return false;
    }
    
    clearTimeout(this.timerId);
    this.timerId = null;
    this.remaining -= Date.now() - this.startTime;
    
    return true;
  }

  /**
   * 일시 정지된 타이머 재개
   * @returns {boolean} 타이머 재개 성공 여부
   */
  resume() {
    if (!this.fsm.executeAction(TimerAction.RESUME)) {
        return false;
    }
    
    this.startTime = Date.now();
    if (this.timerId) {
      throw new Error('Timer already started');
    }
    this.timerId = setTimeout(() => this.#complete(), this.remaining);
    
    return true;
  }

  /**
   * 타이머 초기화 (초기 상태로 재설정)
   * @returns {boolean} 타이머 초기화 성공 여부
   */
  reset() {
    if (!this.fsm.executeAction(TimerAction.RESET)) {
        return false;
    }
    
    clearTimeout(this.timerId);
    this.remaining = this.initialDelay;
    this.timerId = null;
    this.startTime = null;
    
    return true;
  }

  /**
   * 타이머 완료 처리 (내부 메서드)
   * @private
   */
  #complete() {
      if (!this.fsm.executeAction(TimerAction.COMPLETE)) {
        return;
      }
      
      this.timerId = null;
      this.remaining = 0;
      
      // 콜백 함수 실행
      console.log('타이머 완료: 콜백 실행');
      if (this.callback && typeof this.callback === 'function') {
        try {
          this.callback();
        } catch (error) {
          console.error('타이머 콜백 실행 중 오류:', error);
        }
      }
  }

  /**
   * 현재 타이머 상태 반환
   * @returns {string} 현재 상태
   */
  getState() {
    return this.fsm.currentState;
  }

  /**
   * 남은 시간 반환 (밀리초)
   * @returns {number} 남은 시간 (밀리초)
   */
  getRemainingTime() {
    if (this.fsm.currentState === TimerState.RUNNING) {
      const elapsed = Date.now() - this.startTime;
      return Math.max(0, this.remaining - elapsed);
    }
    
    return this.remaining;
  }

  /**
   * 이벤트 리스너 등록
   * @param {TimerAction} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   * @returns {Function} 리스너 제거 함수
   */
  on(event, callback) {
    
    (this.listeners[event] ??= []).push(callback);
    
    // 리스너 제거 함수 반환
    return () => this.off(event, callback);
  }

  /**
   * 이벤트 리스너 제거
   * @param {TimerAction} event - 이벤트 이름
   * @param {Function} callback - 콜백 함수
   */
  off(event, callback) {
    const index = this.listeners[event].indexOf(callback);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  /**
   * 시작 이벤트 리스너 등록
   * @param {Function} callback - 콜백 함수
   * @returns {Function} 리스너 제거 함수
   */
  onStart(callback) {
    return this.on(TimerAction.START, callback);
  }

  /**
   * 일시 정지 이벤트 리스너 등록
   * @param {Function} callback - 콜백 함수
   * @returns {Function} 리스너 제거 함수
   */
  onPause(callback) {
    return this.on(TimerAction.PAUSE, callback);
  }

  /**
   * 재개 이벤트 리스너 등록
   * @param {Function} callback - 콜백 함수
   * @returns {Function} 리스너 제거 함수
   */
  onResume(callback) {
    return this.on(TimerAction.RESUME, callback);
  }

  /**
   * 종료 이벤트 리스너 등록
   * @param {Function} callback - 콜백 함수
   * @returns {Function} 리스너 제거 함수
   */
  onEnd(callback) {
    return this.on(TimerAction.COMPLETE, callback);
  }

  /**
   * 리셋 이벤트 리스너 등록
   * @param {Function} callback - 콜백 함수
   * @returns {Function} 리스너 제거 함수
   */
  onReset(callback) {
    return this.on(TimerAction.RESET, callback);
  }

  /**
   * 타이머 완료 후 다음 타이머 시작
   * @param {Timer} other - 다음 타이머
   * @returns {Function} 리스너 제거 함수
   */
  then(other) {
    this.onEnd(() => {
        other.reset();
        other.start();
    });
    return this;
  }
}

/**
 * 타이머 생성 헬퍼 함수
 * @param {Function} callback - 타이머 종료 시 실행할 콜백 함수
 * @param {number} delay - 타이머 지연 시간 (밀리초)
 * @returns {Timer} 생성된 타이머 인스턴스
 */
export function createTimer(callback, delay) {
  return new Timer(callback, delay);
}
