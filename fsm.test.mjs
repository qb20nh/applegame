/**
 * FSM 클래스를 위한 테스트 스위트
 * 
 * 실행 방법: node fsm.test.mjs
 */

import assert from 'assert';
import FSM from './fsm.mjs';

/**
 * 간단한 테스트 러너
 */
class TestRunner {
  #tests = [];
  #succeeded = 0;
  #failed = 0;

  /**
   * 테스트 케이스 추가
   * @param {string} name - 테스트 이름
   * @param {Function} testFn - 테스트 함수
   */
  addTest(name, testFn) {
    this.#tests.push({ name, testFn });
  }

  /**
   * 모든 테스트 실행
   */
  async run() {
    console.log('테스트 실행 중...\n');

    for (const { name, testFn } of this.#tests) {
      try {
        process.stdout.write(`[테스트] ${name}... `);
        await testFn();
        console.log('✅ 성공');
        this.#succeeded++;
      } catch (error) {
        console.log('❌ 실패');
        console.error(`  오류: ${error.message}`);
        if (error.stack) {
          console.error(`  스택 트레이스: ${error.stack.split('\n')[1]}`);
        }
        this.#failed++;
      }
    }

    console.log('\n테스트 결과 요약:');
    console.log(`총 테스트: ${this.#tests.length}`);
    console.log(`성공: ${this.#succeeded}`);
    console.log(`실패: ${this.#failed}`);

    return this.#failed === 0;
  }
}

// 테스트 러너 생성
const runner = new TestRunner();

/**
 * 추가 엣지 케이스 테스트
 */
runner.addTest('자기 자신으로의 전이', () => {
  const fsm = FSM.simple({
    'A': {'loop': 'A', 'next': 'B'},
    'B': {'prev': 'A'}
  });
  
  assert.strictEqual(fsm.currentState, 'A', '초기 상태는 A여야 함');
  
  // 자기 자신으로 전이
  let callCount = 0;
  fsm.onTransition((from, action, to) => {
    callCount++;
    assert.strictEqual(from, 'A', '시작 상태는 A여야 함');
    assert.strictEqual(action, 'loop', '액션은 loop여야 함');
    assert.strictEqual(to, 'A', '도착 상태도 A여야 함');
  });
  
  fsm.executeAction('loop');
  assert.strictEqual(callCount, 1, '자기 자신으로의 전이도 콜백이 호출되어야 함');
  assert.strictEqual(fsm.currentState, 'A', '상태는 여전히 A여야 함');
});

runner.addTest('동일한 전이 중복 추가', () => {
  const fsm = new FSM(
    ['A', 'B'],
    ['x', 'y'],
    new Map([
      ['A', new Map([['x', 'B']])],
      ['B', new Map([['y', 'A']])]
    ]),
    'A'
  );
  
  // 이미 존재하는 전이 다시 추가
  assert.strictEqual(fsm.addTransition('A', 'x', 'B'), true, '이미 존재하는 전이 추가는 성공해야 함');
  
  // 다른 목적지로 전이 덮어쓰기
  assert.strictEqual(fsm.addTransition('A', 'x', 'A'), true, '전이 덮어쓰기는 성공해야 함');
  
  // 덮어쓰기 확인
  fsm.executeAction('x');
  assert.strictEqual(fsm.currentState, 'A', '덮어쓴 전이가 적용되어야 함');
});

runner.addTest('복잡한 상태 머신 시뮬레이션', () => {
  // 문서 편집기 상태 머신
  const editorFSM = FSM.simple({
    'viewing': {
      'edit': 'editing',
      'delete': 'confirming',
      'save': 'saving',
      'close': 'closed'
    },
    'editing': {
      'save': 'saving',
      'cancel': 'viewing',
      'undo': 'editing',
      'redo': 'editing'
    },
    'confirming': {
      'confirm': 'deleting',
      'cancel': 'viewing'
    },
    'deleting': {
      'complete': 'viewing',
      'error': 'error'
    },
    'saving': {
      'complete': 'viewing',
      'error': 'error'
    },
    'error': {
      'retry': 'viewing',
      'close': 'closed'
    },
    'closed': {
      'open': 'viewing'
    }
  });
  
  // 상태 전이 기록
  const stateHistory = [];
  editorFSM.onTransition((from, action, to) => {
    stateHistory.push({ from, action, to });
  });
  
  // 시나리오 1: 편집 후 저장
  assert.strictEqual(editorFSM.currentState, 'viewing', '초기 상태는 viewing이어야 함');
  editorFSM.executeAction('edit');
  editorFSM.executeAction('save');
  editorFSM.executeAction('complete');
  
  // 시나리오 2: 삭제 확인 후 취소
  editorFSM.executeAction('delete');
  editorFSM.executeAction('cancel');
  
  // 시나리오 3: 편집 중 취소
  editorFSM.executeAction('edit');
  editorFSM.executeAction('cancel');
  
  // 시나리오 4: 삭제 후 오류 발생
  editorFSM.executeAction('delete');
  editorFSM.executeAction('confirm');
  editorFSM.executeAction('error');
  
  // 시나리오 5: 오류에서 재시도 후 닫기
  editorFSM.executeAction('retry');
  editorFSM.executeAction('close');
  
  // 시나리오 6: 닫힌 상태에서 다시 열기
  editorFSM.executeAction('open');
  
  // 상태 기록 검증
  assert.strictEqual(stateHistory.length, 13, '총 13번의 상태 전이가 있어야 함');
  assert.strictEqual(editorFSM.currentState, 'viewing', '최종 상태는 viewing이어야 함');
  
  // 특정 전이 검증
  assert.deepStrictEqual(stateHistory[0], { from: 'viewing', action: 'edit', to: 'editing' }, '첫 번째 전이 확인');
  assert.deepStrictEqual(stateHistory[stateHistory.length - 1], { from: 'closed', action: 'open', to: 'viewing' }, '마지막 전이 확인');
});

runner.addTest('초기 상태 지정 없는 생성자', () => {
  const fsm = new FSM(
    ['A', 'B', 'C'],
    ['x', 'y', 'z'],
    new Map([
      ['A', new Map([['x', 'B']])],
      ['B', new Map([['y', 'C']])],
      ['C', new Map([['z', 'A']])]
    ])
  );
  
  assert.strictEqual(fsm.currentState, 'A', '초기 상태는 첫 번째 상태여야 함');
});

runner.addTest('빈 전이 맵으로 생성', () => {
  const fsm = new FSM(['A', 'B'], ['x', 'y'], new Map());
  
  // 모든 상태에 대한 빈 액션 맵이 생성되어야 함
  const transitionMap = fsm.getTransitionMap();
  assert.strictEqual(transitionMap.size, 2, '전이 맵에는 2개의 상태가 있어야 함');
  assert.ok(transitionMap.has('A'), '상태 A가 전이 맵에 존재해야 함');
  assert.ok(transitionMap.has('B'), '상태 B가 전이 맵에 존재해야 함');
  
  // 각 상태에 대한 액션 맵은 비어 있어야 함
  assert.strictEqual(transitionMap.get('A').size, 0, '상태 A의 액션 맵은 비어 있어야 함');
  assert.strictEqual(transitionMap.get('B').size, 0, '상태 B의 액션 맵은 비어 있어야 함');
  
  // 액션 실행 시도
  assert.strictEqual(fsm.executeAction('x'), false, '정의되지 않은 전이는 실패해야 함');
});

runner.addTest('simple 메서드 - 상태와 액션 추출', () => {
  // 상태와 액션이 중복되는 복잡한 객체
  const complexObj = {
    'state1': { 'action1': 'state2', 'action2': 'state3', 'action3': 'state1' },
    'state2': { 'action1': 'state3', 'action2': 'state1' },
    'state3': { 'action3': 'state1', 'action4': 'state2' }
  };
  
  const fsm = FSM.simple(complexObj);
  
  // 상태 목록 확인
  const states = fsm.states;
  assert.strictEqual(states.length, 3, '상태는 3개여야 함');
  assert.ok(states.includes('state1'), 'state1이 포함되어야 함');
  assert.ok(states.includes('state2'), 'state2가 포함되어야 함');
  assert.ok(states.includes('state3'), 'state3이 포함되어야 함');
  
  // 액션 목록 확인
  const actions = fsm.actions;
  assert.strictEqual(actions.length, 4, '액션은 4개여야 함');
  assert.ok(actions.includes('action1'), 'action1이 포함되어야 함');
  assert.ok(actions.includes('action2'), 'action2가 포함되어야 함');
  assert.ok(actions.includes('action3'), 'action3이 포함되어야 함');
  assert.ok(actions.includes('action4'), 'action4가 포함되어야 함');
  
  // 초기 상태 확인
  assert.strictEqual(fsm.currentState, 'state1', '초기 상태는 state1이어야 함');
  
  // 전이 확인
  fsm.executeAction('action1');
  assert.strictEqual(fsm.currentState, 'state2', '상태가 state2로 변경되어야 함');
  
  fsm.executeAction('action1');
  assert.strictEqual(fsm.currentState, 'state3', '상태가 state3로 변경되어야 함');
  
  fsm.executeAction('action3');
  assert.strictEqual(fsm.currentState, 'state1', '상태가 state1로 변경되어야 함');
});

runner.addTest('존재하지 않는 상태로의 전이 정의', () => {
  // 존재하지 않는 상태를 참조하는 객체
  const invalidObj = {
    'state1': { 'action1': 'state2' },
    'state2': { 'action2': 'nonexistent' }
  };
  
  // simple 메서드는 모든 참조된 상태를 자동으로 추가하므로 예외가 발생하지 않아야 함
  const fsm = FSM.simple(invalidObj);
  
  // 상태 목록 확인
  const states = fsm.states;
  assert.strictEqual(states.length, 3, '상태는 3개여야 함');
  assert.ok(states.includes('nonexistent'), 'nonexistent 상태가 자동으로 추가되어야 함');
  
  // 전이 확인
  fsm.executeAction('action1');
  assert.strictEqual(fsm.currentState, 'state2', '상태가 state2로 변경되어야 함');
  
  fsm.executeAction('action2');
  assert.strictEqual(fsm.currentState, 'nonexistent', '상태가 nonexistent로 변경되어야 함');
});

/**
 * 기본 기능 테스트
 */
runner.addTest('기본 생성 및 초기화', () => {
  const states = ['A', 'B', 'C'];
  const actions = ['x', 'y', 'z'];
  const transitions = new Map([
    ['A', new Map([['x', 'B'], ['y', 'C']])],
    ['B', new Map([['z', 'A']])],
    ['C', new Map([['x', 'A']])]
  ]);

  const fsm = new FSM(states, actions, transitions, 'A');
  
  assert.strictEqual(fsm.currentState, 'A', '초기 상태는 A여야 합니다');
  assert.deepStrictEqual(fsm.states, states, '상태 목록이 일치해야 합니다');
  assert.deepStrictEqual(fsm.actions, actions, '액션 목록이 일치해야 합니다');
  
  const availableActions = fsm.getAvailableActions();
  assert.strictEqual(availableActions.length, 2, 'A 상태에서 가능한 액션은 2개여야 합니다');
  assert.ok(availableActions.includes('x'), 'A 상태에서 x 액션이 가능해야 합니다');
  assert.ok(availableActions.includes('y'), 'A 상태에서 y 액션이 가능해야 합니다');
});

runner.addTest('상태 전이 기본 동작', () => {
  const fsm = new FSM(
    ['A', 'B', 'C'],
    ['x', 'y', 'z'],
    new Map([
      ['A', new Map([['x', 'B']])],
      ['B', new Map([['y', 'C']])],
      ['C', new Map([['z', 'A']])]
    ]),
    'A'
  );
  
  // A -> B
  assert.strictEqual(fsm.executeAction('x'), true, 'x 액션 실행 성공해야 함');
  assert.strictEqual(fsm.currentState, 'B', '상태가 B로 변경되어야 함');
  
  // B -> C
  assert.strictEqual(fsm.executeAction('y'), true, 'y 액션 실행 성공해야 함');
  assert.strictEqual(fsm.currentState, 'C', '상태가 C로 변경되어야 함');
  
  // C -> A
  assert.strictEqual(fsm.executeAction('z'), true, 'z 액션 실행 성공해야 함');
  assert.strictEqual(fsm.currentState, 'A', '상태가 A로 변경되어야 함');
});

runner.addTest('존재하지 않는 액션 실행', () => {
  const fsm = new FSM(
    ['A', 'B'],
    ['x', 'y'],
    new Map([
      ['A', new Map([['x', 'B']])],
      ['B', new Map([['y', 'A']])]
    ]),
    'A'
  );
  
  // 현재 상태 A에서 y 액션은 정의되지 않음
  assert.strictEqual(fsm.executeAction('y'), false, '존재하지 않는 전이 시 false 반환해야 함');
  assert.strictEqual(fsm.currentState, 'A', '상태가 변경되지 않아야 함');
  
  // 존재하지 않는 액션 시도
  assert.throws(() => {
    fsm.executeAction('z');
  }, /액션 "z"이 유효한 액션이 아닙니다/, '존재하지 않는 액션 실행 시 예외 발생해야 함');
});

runner.addTest('전이 이벤트 콜백', () => {
  const fsm = new FSM(
    ['A', 'B', 'C'],
    ['x', 'y'],
    new Map([
      ['A', new Map([['x', 'B']])],
      ['B', new Map([['y', 'C']])],
      ['C', new Map([['x', 'A']])]
    ]),
    'A'
  );
  
  let callCount = 0;
  let lastTransition = null;
  
  // 콜백 등록
  const removeCallback = fsm.onTransition((from, action, to) => {
    callCount++;
    lastTransition = { from, action, to };
  });
  
  // A -> B
  fsm.executeAction('x');
  assert.strictEqual(callCount, 1, '콜백이 1번 호출되어야 함');
  assert.deepStrictEqual(lastTransition, { from: 'A', action: 'x', to: 'B' }, '전이 정보가 올바름');
  
  // B -> C
  fsm.executeAction('y');
  assert.strictEqual(callCount, 2, '콜백이 2번 호출되어야 함');
  assert.deepStrictEqual(lastTransition, { from: 'B', action: 'y', to: 'C' }, '전이 정보가 올바름');
  
  // 콜백 제거
  removeCallback();
  
  // C -> A (콜백 호출 안 됨)
  fsm.executeAction('x');
  assert.strictEqual(callCount, 2, '콜백이 더 이상 호출되지 않아야 함');
  assert.deepStrictEqual(lastTransition, { from: 'B', action: 'y', to: 'C' }, '전이 정보가 변경되지 않아야 함');
});

runner.addTest('전이 맵 수정', () => {
  const fsm = new FSM(
    ['A', 'B', 'C'],
    ['x', 'y', 'z'],
    new Map([
      ['A', new Map([['x', 'B']])],
      ['B', new Map([['y', 'C']])],
      ['C', new Map([['z', 'A']])]
    ]),
    'A'
  );
  
  // 새로운 전이 추가
  assert.strictEqual(fsm.addTransition('A', 'y', 'C'), true, '전이 추가 성공해야 함');
  
  // 추가된 전이 확인
  fsm.executeAction('y');
  assert.strictEqual(fsm.currentState, 'C', '추가된 전이가 작동해야 함');
  
  // 전이 제거
  assert.strictEqual(fsm.removeTransition('C', 'z'), true, '전이 제거 성공해야 함');
  
  // 제거된 전이 확인
  assert.strictEqual(fsm.executeAction('z'), false, '제거된 전이는 실패해야 함');
  assert.strictEqual(fsm.currentState, 'C', '상태가 변경되지 않아야 함');
  
  // 존재하지 않는 전이 제거 시도
  assert.strictEqual(fsm.removeTransition('B', 'z'), false, '존재하지 않는 전이 제거 실패해야 함');
  
  // 유효하지 않은 상태/액션으로 전이 추가 시도
  assert.strictEqual(fsm.addTransition('D', 'x', 'A'), false, '유효하지 않은 상태로 전이 추가 실패해야 함');
  assert.strictEqual(fsm.addTransition('A', 'w', 'B'), false, '유효하지 않은 액션으로 전이 추가 실패해야 함');
  assert.strictEqual(fsm.addTransition('A', 'x', 'D'), false, '유효하지 않은 상태로 전이 추가 실패해야 함');
});

runner.addTest('생성자 유효성 검사', () => {
  // 빈 상태 목록
  assert.throws(() => {
    new FSM([], ['x'], new Map());
  }, /상태 목록은 비어있을 수 없습니다/, '빈 상태 목록으로 생성 시 예외 발생해야 함');
  
  // 빈 액션 목록
  assert.throws(() => {
    new FSM(['A'], [], new Map());
  }, /액션 목록은 비어있을 수 없습니다/, '빈 액션 목록으로 생성 시 예외 발생해야 함');
  
  // 유효하지 않은 초기 상태
  assert.throws(() => {
    new FSM(['A', 'B'], ['x'], new Map(), 'C');
  }, /초기 상태 "C"가 유효한 상태가 아닙니다/, '유효하지 않은 초기 상태로 생성 시 예외 발생해야 함');
  
  // 유효하지 않은 전이 맵 (존재하지 않는 상태)
  const invalidTransitions1 = new Map([
    ['C', new Map([['x', 'A']])]
  ]);
  assert.throws(() => {
    new FSM(['A', 'B'], ['x'], invalidTransitions1);
  }, /상태 "C"가 유효한 상태가 아닙니다/, '유효하지 않은 상태가 있는 전이 맵으로 생성 시 예외 발생해야 함');
  
  // 유효하지 않은 전이 맵 (존재하지 않는 액션)
  const invalidTransitions2 = new Map([
    ['A', new Map([['y', 'B']])]
  ]);
  assert.throws(() => {
    new FSM(['A', 'B'], ['x'], invalidTransitions2);
  }, /액션 "y"이 유효한 액션이 아닙니다/, '유효하지 않은 액션이 있는 전이 맵으로 생성 시 예외 발생해야 함');
  
  // 유효하지 않은 전이 맵 (존재하지 않는 목적 상태)
  const invalidTransitions3 = new Map([
    ['A', new Map([['x', 'C']])]
  ]);
  assert.throws(() => {
    new FSM(['A', 'B'], ['x'], invalidTransitions3);
  }, /상태 "C"가 유효한 상태가 아닙니다/, '유효하지 않은 목적 상태가 있는 전이 맵으로 생성 시 예외 발생해야 함');
});

runner.addTest('simple 팩토리 메서드', () => {
  // 기본 동작 테스트
  const trafficLight = FSM.simple({
    'red': {'timer': 'green'},
    'green': {'timer': 'yellow'},
    'yellow': {'timer': 'red'}
  });
  
  assert.strictEqual(trafficLight.currentState, 'red', '초기 상태는 객체의 첫 번째 키여야 함');
  assert.deepStrictEqual(trafficLight.states.sort(), ['green', 'red', 'yellow'], '상태 목록이 올바름');
  assert.deepStrictEqual(trafficLight.actions, ['timer'], '액션 목록이 올바름');
  
  // 상태 전이 테스트
  trafficLight.executeAction('timer');
  assert.strictEqual(trafficLight.currentState, 'green', '상태가 green으로 변경되어야 함');
  
  trafficLight.executeAction('timer');
  assert.strictEqual(trafficLight.currentState, 'yellow', '상태가 yellow로 변경되어야 함');
  
  trafficLight.executeAction('timer');
  assert.strictEqual(trafficLight.currentState, 'red', '상태가 red로 변경되어야 함');
  
  // 더 복잡한 예제
  const gameFSM = FSM.simple({
    'idle': { 'move': 'walking', 'attack': 'attacking' },
    'walking': { 'stop': 'idle', 'run': 'running' },
    'running': { 'stop': 'idle' },
    'attacking': { 'finish': 'idle' }
  });
  
  assert.strictEqual(gameFSM.currentState, 'idle', '초기 상태는 idle이어야 함');
  assert.deepStrictEqual(gameFSM.states.sort(), ['attacking', 'idle', 'running', 'walking'], '상태 목록이 올바름');
  assert.deepStrictEqual(gameFSM.actions.sort(), ['attack', 'finish', 'move', 'run', 'stop'], '액션 목록이 올바름');
  
  // 빈 객체 테스트
  assert.throws(() => {
    FSM.simple({});
  }, /전이 객체는 비어있을 수 없습니다/, '빈 객체로 생성 시 예외 발생해야 함');
  
  // null/undefined 테스트
  assert.throws(() => {
    FSM.simple(null);
  }, /전이 객체는 비어있을 수 없습니다/, 'null로 생성 시 예외 발생해야 함');
  
  assert.throws(() => {
    FSM.simple(undefined);
  }, /전이 객체는 비어있을 수 없습니다/, 'undefined로 생성 시 예외 발생해야 함');
});

runner.addTest('전체 순환 테스트', () => {
  // 더 복잡한 FSM 생성
  const complexFSM = FSM.simple({
    'start': { 'init': 'ready', 'reset': 'start' },
    'ready': { 'begin': 'processing', 'cancel': 'start' },
    'processing': { 'finish': 'done', 'error': 'error', 'cancel': 'ready' },
    'done': { 'reset': 'start', 'continue': 'ready' },
    'error': { 'retry': 'ready', 'reset': 'start' }
  });
  
  // 다양한 경로로 전이 테스트
  assert.strictEqual(complexFSM.currentState, 'start', '초기 상태는 start여야 함');
  
  // 경로 1: start -> ready -> processing -> done -> start
  complexFSM.executeAction('init');
  assert.strictEqual(complexFSM.currentState, 'ready', '상태가 ready로 변경되어야 함');
  
  complexFSM.executeAction('begin');
  assert.strictEqual(complexFSM.currentState, 'processing', '상태가 processing으로 변경되어야 함');
  
  complexFSM.executeAction('finish');
  assert.strictEqual(complexFSM.currentState, 'done', '상태가 done으로 변경되어야 함');
  
  complexFSM.executeAction('reset');
  assert.strictEqual(complexFSM.currentState, 'start', '상태가 start로 변경되어야 함');
  
  // 경로 2: start -> ready -> processing -> error -> ready
  complexFSM.executeAction('init');
  complexFSM.executeAction('begin');
  complexFSM.executeAction('error');
  assert.strictEqual(complexFSM.currentState, 'error', '상태가 error로 변경되어야 함');
  
  complexFSM.executeAction('retry');
  assert.strictEqual(complexFSM.currentState, 'ready', '상태가 ready로 변경되어야 함');
  
  // 경로 3: ready -> start (취소)
  complexFSM.executeAction('cancel');
  assert.strictEqual(complexFSM.currentState, 'start', '상태가 start로 변경되어야 함');
});

runner.addTest('다중 콜백 테스트', () => {
  const fsm = FSM.simple({
    'A': {'x': 'B'},
    'B': {'y': 'C'},
    'C': {'z': 'A'}
  });
  
  let counter1 = 0;
  let counter2 = 0;
  
  // 두 개의 콜백 등록
  const removeCallback1 = fsm.onTransition(() => { counter1++; });
  const removeCallback2 = fsm.onTransition(() => { counter2++; });
  
  // A -> B
  fsm.executeAction('x');
  assert.strictEqual(counter1, 1, '첫 번째 콜백이 호출되어야 함');
  assert.strictEqual(counter2, 1, '두 번째 콜백이 호출되어야 함');
  
  // B -> C (첫 번째 콜백 제거 후)
  removeCallback1();
  fsm.executeAction('y');
  assert.strictEqual(counter1, 1, '첫 번째 콜백은 더 이상 호출되지 않아야 함');
  assert.strictEqual(counter2, 2, '두 번째 콜백이 두 번 호출되어야 함');
  
  // C -> A (두 번째 콜백 제거 후)
  removeCallback2();
  fsm.executeAction('z');
  assert.strictEqual(counter1, 1, '첫 번째 콜백은 더 이상 호출되지 않아야 함');
  assert.strictEqual(counter2, 2, '두 번째 콜백도 더 이상 호출되지 않아야 함');
});

runner.addTest('getTransitionMap 메서드', () => {
  const originalTransitions = new Map([
    ['A', new Map([['x', 'B']])],
    ['B', new Map([['y', 'C']])],
    ['C', new Map([['z', 'A']])]
  ]);
  
  const fsm = new FSM(['A', 'B', 'C'], ['x', 'y', 'z'], originalTransitions, 'A');
  
  // 전이 맵 가져오기
  const transitionMap = fsm.getTransitionMap();
  
  // 원본과 동일한지 확인
  assert.strictEqual(transitionMap.size, originalTransitions.size, '전이 맵의 크기가 같아야 함');
  
  for (const [state, actions] of originalTransitions.entries()) {
    assert.ok(transitionMap.has(state), `상태 ${state}가 전이 맵에 존재해야 함`);
    
    const mappedActions = transitionMap.get(state);
    assert.strictEqual(mappedActions.size, actions.size, `상태 ${state}의 액션 맵 크기가 같아야 함`);
    
    for (const [action, nextState] of actions.entries()) {
      assert.ok(mappedActions.has(action), `액션 ${action}이 액션 맵에 존재해야 함`);
      assert.strictEqual(mappedActions.get(action), nextState, `액션 ${action}의 다음 상태가 같아야 함`);
    }
  }
  
  // 반환된 맵 수정이 원본에 영향을 주지 않는지 확인
  const retrievedMap = transitionMap.get('A');
  retrievedMap.set('newAction', 'C');
  
  // 원본 FSM의 전이 맵에는 변경이 없어야 함
  // 유효하지 않은 액션이므로 executeAction 대신 getAvailableActions 사용
  const availableActions = fsm.getAvailableActions();
  assert.ok(!availableActions.includes('newAction'), '원본 FSM은 수정되지 않아야 함');
});

/**
 * 에러 발생 테스트 케이스
 */
runner.addTest('executeAction 에러 - 존재하지 않는 액션', () => {
  const fsm = FSM.simple({
    'A': {'x': 'B'},
    'B': {'y': 'A'}
  });
  
  // 존재하지 않는 액션 실행 시도
  assert.throws(() => {
    fsm.executeAction('z');
  }, /액션 "z"이 유효한 액션이 아닙니다/, '존재하지 않는 액션 실행 시 예외 발생해야 함');
});

runner.addTest('FSM.simple 에러 - 빈 객체', () => {
  assert.throws(() => {
    FSM.simple({});
  }, /전이 객체는 비어있을 수 없습니다/, '빈 객체로 생성 시 예외 발생해야 함');
});

runner.addTest('FSM.simple 에러 - null/undefined 입력', () => {
  assert.throws(() => {
    FSM.simple(null);
  }, /전이 객체는 비어있을 수 없습니다/, 'null로 생성 시 예외 발생해야 함');
  
  assert.throws(() => {
    FSM.simple(undefined);
  }, /전이 객체는 비어있을 수 없습니다/, 'undefined로 생성 시 예외 발생해야 함');
  
  assert.throws(() => {
    FSM.simple('문자열');
  }, /전이 객체는 비어있을 수 없습니다/, '문자열로 생성 시 예외 발생해야 함');
  
  assert.throws(() => {
    FSM.simple(123);
  }, /전이 객체는 비어있을 수 없습니다/, '숫자로 생성 시 예외 발생해야 함');
});

runner.addTest('생성자 에러 - 빈 상태 목록', () => {
  assert.throws(() => {
    new FSM([], ['x'], new Map());
  }, /상태 목록은 비어있을 수 없습니다/, '빈 상태 목록으로 생성 시 예외 발생해야 함');
});

runner.addTest('생성자 에러 - 빈 액션 목록', () => {
  assert.throws(() => {
    new FSM(['A'], [], new Map());
  }, /액션 목록은 비어있을 수 없습니다/, '빈 액션 목록으로 생성 시 예외 발생해야 함');
});

runner.addTest('생성자 에러 - 유효하지 않은 초기 상태', () => {
  assert.throws(() => {
    new FSM(['A', 'B'], ['x'], new Map(), 'C');
  }, /초기 상태 "C"가 유효한 상태가 아닙니다/, '유효하지 않은 초기 상태로 생성 시 예외 발생해야 함');
});

runner.addTest('생성자 에러 - 유효하지 않은 전이 맵 (존재하지 않는 상태)', () => {
  const invalidTransitions = new Map([
    ['C', new Map([['x', 'A']])]
  ]);
  assert.throws(() => {
    new FSM(['A', 'B'], ['x'], invalidTransitions);
  }, /상태 "C"가 유효한 상태가 아닙니다/, '유효하지 않은 상태가 있는 전이 맵으로 생성 시 예외 발생해야 함');
});

runner.addTest('생성자 에러 - 유효하지 않은 전이 맵 (존재하지 않는 액션)', () => {
  const invalidTransitions = new Map([
    ['A', new Map([['y', 'B']])]
  ]);
  assert.throws(() => {
    new FSM(['A', 'B'], ['x'], invalidTransitions);
  }, /액션 "y"이 유효한 액션이 아닙니다/, '유효하지 않은 액션이 있는 전이 맵으로 생성 시 예외 발생해야 함');
});

runner.addTest('생성자 에러 - 유효하지 않은 전이 맵 (존재하지 않는 목적 상태)', () => {
  const invalidTransitions = new Map([
    ['A', new Map([['x', 'C']])]
  ]);
  assert.throws(() => {
    new FSM(['A', 'B'], ['x'], invalidTransitions);
  }, /상태 "C"가 유효한 상태가 아닙니다/, '유효하지 않은 목적 상태가 있는 전이 맵으로 생성 시 예외 발생해야 함');
});

runner.addTest('액션 실행 에러 - 타입 오류', () => {
  const fsm = FSM.simple({
    'A': {'x': 'B'},
    'B': {'y': 'A'}
  });
  
  // 잘못된 타입의 액션 실행 시도
  assert.throws(() => {
    fsm.executeAction(null);
  }, /액션 "null"이 유효한 액션이 아닙니다/, 'null 액션 실행 시 예외 발생해야 함');
  
  assert.throws(() => {
    fsm.executeAction(undefined);
  }, /액션 "undefined"이 유효한 액션이 아닙니다/, 'undefined 액션 실행 시 예외 발생해야 함');
  
  assert.throws(() => {
    fsm.executeAction({});
  }, /액션 "\[object Object\]"이 유효한 액션이 아닙니다/, '객체 액션 실행 시 예외 발생해야 함');
  
  assert.throws(() => {
    fsm.executeAction(123);
  }, /액션 "123"이 유효한 액션이 아닙니다/, '숫자 액션 실행 시 예외 발생해야 함');
});

/**
 * 중첩 상태 시뮬레이션 테스트
 */
runner.addTest('중첩 상태 관계 시뮬레이션', () => {
  // 중첩 상태 관계를 표현하는 FSM
  // 상위 상태: 'day', 'night'
  // 하위 상태: 'working', 'resting', 'sleeping', 'dreaming'
  const dayNightFSM = FSM.simple({
    'day.working': { 
      'finish': 'day.resting', 
      'sunset': 'night.resting',
      'emergency': 'night.working'
    },
    'day.resting': { 
      'resume': 'day.working', 
      'sunset': 'night.sleeping' 
    },
    'night.working': { 
      'finish': 'night.resting', 
      'sunrise': 'day.working',
      'emergency': 'day.working' 
    },
    'night.resting': { 
      'resume': 'night.working', 
      'sleep': 'night.sleeping',
      'sunrise': 'day.working' 
    },
    'night.sleeping': { 
      'wake': 'night.resting', 
      'dream': 'night.dreaming',
      'sunrise': 'day.resting' 
    },
    'night.dreaming': { 
      'wake': 'night.sleeping', 
      'sunrise': 'day.working' 
    }
  });
  
  // 1. 상태 및 액션 확인
  const states = dayNightFSM.states;
  const actions = dayNightFSM.actions;
  
  assert.ok(states.includes('day.working'), 'day.working 상태가 존재해야 함');
  assert.ok(states.includes('night.dreaming'), 'night.dreaming 상태가 존재해야 함');
  assert.ok(actions.includes('sunrise'), 'sunrise 액션이 존재해야 함');
  assert.ok(actions.includes('sunset'), 'sunset 액션이 존재해야 함');
  
  // 2. 초기 상태 확인
  assert.strictEqual(dayNightFSM.currentState, 'day.working', '초기 상태는 day.working이어야 함');
  
  // 3. 상태 전이 기록을 위한 콜백 설정
  const transitions = [];
  const removeCallback = dayNightFSM.onTransition((from, action, to) => {
    transitions.push({ from, action, to });
  });
  
  // 4. 시나리오 1: 주간 작업 → 휴식 → 일몰 → 수면 → 꿈 → 일출
  // 시나리오 각 단계마다 상태 검증
  dayNightFSM.executeAction('finish');
  assert.strictEqual(dayNightFSM.currentState, 'day.resting', 
    '작업 완료 후 상태가 day.resting으로 변경되어야 함');
  
  dayNightFSM.executeAction('sunset');
  assert.strictEqual(dayNightFSM.currentState, 'night.sleeping', 
    '일몰 후 상태가 night.sleeping으로 변경되어야 함');
  
  dayNightFSM.executeAction('dream');
  assert.strictEqual(dayNightFSM.currentState, 'night.dreaming', 
    '꿈을 꾸기 시작하면 상태가 night.dreaming으로 변경되어야 함');
  
  dayNightFSM.executeAction('sunrise');
  assert.strictEqual(dayNightFSM.currentState, 'day.working', 
    '일출 후 상태가 day.working으로 변경되어야 함');
  
  // 5. 시나리오 2: 특수 전이 확인 (현재 상태에서 night.resting으로 전이)
  dayNightFSM.executeAction('sunset');
  assert.strictEqual(dayNightFSM.currentState, 'night.resting', 
    '주간 작업에서 일몰 후 상태가 night.resting으로 변경되어야 함');
  
  // 6. 전이 기록 확인
  assert.strictEqual(transitions.length, 5, '총 5번의 상태 전이가 있어야 함');
  assert.deepStrictEqual(
    transitions.map(t => t.action),
    ['finish', 'sunset', 'dream', 'sunrise', 'sunset'],
    '액션 순서가 올바르게 기록되어야 함'
  );
  
  // 7. 부모 상태 추출 확인
  function getParentState(state) {
    return state.split('.')[0];
  }
  
  const currentParentState = getParentState(dayNightFSM.currentState);
  assert.strictEqual(currentParentState, 'night', '현재 상위 상태는 night여야 함');
  
  // 8. 콜백 제거 확인
  removeCallback();
  dayNightFSM.executeAction('resume');
  assert.strictEqual(transitions.length, 5, '콜백 제거 후에는 전이가 기록되지 않아야 함');
});

/**
 * 콜백 메모리 관리 테스트
 */
runner.addTest('콜백 메모리 관리 및 해제', () => {
  const fsm = FSM.simple({
    'A': {'next': 'B', 'skip': 'C'},
    'B': {'next': 'C'},
    'C': {'next': 'A'}
  });
  
  // 여러 콜백 등록
  const counts = {
    callback1: 0,
    callback2: 0,
    callback3: 0
  };
  
  // 첫 번째 콜백
  const removeCallback1 = fsm.onTransition(() => {
    counts.callback1++;
  });
  
  // 두 번째 콜백
  const removeCallback2 = fsm.onTransition(() => {
    counts.callback2++;
  });
  
  // 첫 번째 전이: 모든 콜백 실행
  fsm.executeAction('next');
  assert.strictEqual(counts.callback1, 1, '첫 번째 콜백이 호출되어야 함');
  assert.strictEqual(counts.callback2, 1, '두 번째 콜백이 호출되어야 함');
  assert.strictEqual(counts.callback3, 0, '세 번째 콜백은 아직 등록되지 않음');
  
  // 첫 번째 콜백 제거
  removeCallback1();
  
  // 두 번째 전이: 두 번째 콜백만 실행
  fsm.executeAction('next');
  assert.strictEqual(counts.callback1, 1, '첫 번째 콜백은 더 이상 호출되지 않아야 함');
  assert.strictEqual(counts.callback2, 2, '두 번째 콜백이 다시 호출되어야 함');
  
  // 세 번째 콜백 등록
  const removeCallback3 = fsm.onTransition(() => {
    counts.callback3++;
  });
  
  // 세 번째 전이: 두 번째, 세 번째 콜백 실행
  fsm.executeAction('next');
  assert.strictEqual(counts.callback1, 1, '첫 번째 콜백은 더 이상 호출되지 않아야 함');
  assert.strictEqual(counts.callback2, 3, '두 번째 콜백이 세 번 호출되어야 함');
  assert.strictEqual(counts.callback3, 1, '세 번째 콜백이 호출되어야 함');
  
  // 모든 콜백 제거
  removeCallback2();
  removeCallback3();
  
  // 네 번째 전이: 콜백 호출 없음
  fsm.executeAction('skip');
  assert.strictEqual(counts.callback1, 1, '첫 번째 콜백 호출 횟수 변화 없음');
  assert.strictEqual(counts.callback2, 3, '두 번째 콜백 호출 횟수 변화 없음');
  assert.strictEqual(counts.callback3, 1, '세 번째 콜백 호출 횟수 변화 없음');
  
  // 중복 제거 시도 (이미 제거된 콜백)
  removeCallback1(); // 이미 제거됨
  removeCallback2(); // 이미 제거됨
  
  // 다섯 번째 전이: 여전히 콜백 호출 없음
  fsm.executeAction('next');
  assert.strictEqual(counts.callback1, 1, '첫 번째 콜백 호출 횟수 변화 없음');
  assert.strictEqual(counts.callback2, 3, '두 번째 콜백 호출 횟수 변화 없음');
  assert.strictEqual(counts.callback3, 1, '세 번째 콜백 호출 횟수 변화 없음');
  
  // 콜백 재등록 (같은 함수 객체)
  const callback = () => { counts.callback1++; };
  const remove1 = fsm.onTransition(callback);
  const remove2 = fsm.onTransition(callback); // 동일 함수 재등록
  
  // 여섯 번째 전이: 동일 콜백이 두 번 호출됨
  fsm.executeAction('next');
  assert.strictEqual(counts.callback1, 3, '동일한 콜백이 두 번 호출되어야 함');
  
  // 첫 번째 등록 제거
  remove1();
  
  // 일곱 번째 전이: 여전히 한 번 호출됨
  fsm.executeAction('next');
  assert.strictEqual(counts.callback1, 4, '두 번째 등록은 여전히 유효해야 함');
  
  // 두 번째 등록도 제거
  remove2();
  
  // 여덟 번째 전이: 호출 없음
  fsm.executeAction('next');
  assert.strictEqual(counts.callback1, 4, '모든 등록이 제거되어 호출되지 않아야 함');
});

/**
 * 특수 문자를 포함한 상태 및 액션 이름 테스트
 */
runner.addTest('특수 문자가 포함된 상태 및 액션 이름', () => {
  // 특수 문자가 포함된 상태 및 액션 이름으로 FSM 생성
  const specialFSM = FSM.simple({
    'state-with-dash': {
      'action/with/slash': 'state with space',
      'action.with.dots': 'state_with_underscore'
    },
    'state with space': {
      'action_with_symbols!@#': 'state_with_underscore',
      'numbers123': 'state-with-dash'
    },
    'state_with_underscore': {
      '한글액션': 'state-with-dash',
      '😀emoji😀': 'state with space'
    }
  });
  
  // 상태 목록 검증
  const states = specialFSM.states;
  assert.strictEqual(states.length, 3, '상태는 3개여야 함');
  assert.ok(states.includes('state-with-dash'), '대시가 포함된 상태명이 처리되어야 함');
  assert.ok(states.includes('state with space'), '공백이 포함된 상태명이 처리되어야 함');
  assert.ok(states.includes('state_with_underscore'), '언더스코어가 포함된 상태명이 처리되어야 함');
  
  // 액션 목록 검증
  const actions = specialFSM.actions;
  assert.strictEqual(actions.length, 6, '액션은 6개여야 함');
  assert.ok(actions.includes('action/with/slash'), '슬래시가 포함된 액션명이 처리되어야 함');
  assert.ok(actions.includes('action.with.dots'), '점이 포함된 액션명이 처리되어야 함');
  assert.ok(actions.includes('action_with_symbols!@#'), '특수 기호가 포함된 액션명이 처리되어야 함');
  assert.ok(actions.includes('numbers123'), '숫자가 포함된 액션명이 처리되어야 함');
  assert.ok(actions.includes('한글액션'), '한글이 포함된 액션명이 처리되어야 함');
  assert.ok(actions.includes('😀emoji😀'), '이모지가 포함된 액션명이 처리되어야 함');
  
  // 전이 테스트
  assert.strictEqual(specialFSM.currentState, 'state-with-dash', '초기 상태는 state-with-dash여야 함');
  
  // 슬래시와 공백 포함 전이
  specialFSM.executeAction('action/with/slash');
  assert.strictEqual(specialFSM.currentState, 'state with space', '상태가 변경되어야 함');
  
  // 특수 기호와 언더스코어 포함 전이
  specialFSM.executeAction('action_with_symbols!@#');
  assert.strictEqual(specialFSM.currentState, 'state_with_underscore', '상태가 변경되어야 함');
  
  // 한글 및 이모지 포함 전이
  specialFSM.executeAction('한글액션');
  assert.strictEqual(specialFSM.currentState, 'state-with-dash', '상태가 변경되어야 함');
  
  specialFSM.executeAction('action/with/slash');
  specialFSM.executeAction('numbers123');
  assert.strictEqual(specialFSM.currentState, 'state-with-dash', '상태가 변경되어야 함');
  
  // UTF-8 문자 테스트
  specialFSM.executeAction('action/with/slash');
  specialFSM.executeAction('action_with_symbols!@#');
  specialFSM.executeAction('😀emoji😀');
  assert.strictEqual(specialFSM.currentState, 'state with space', '이모지 액션으로 상태가 변경되어야 함');
});

/**
 * 예외 상황 및 경계 조건 테스트
 * FSM API가 다양한 예외 상황과 경계 조건에서 올바르게 동작하는지 확인
 */
runner.addTest('예외 상황 및 경계 조건 처리', () => {
  // 1. 매우 긴 상태/액션 이름 처리 테스트
  const longStateName = 'A'.repeat(1000);
  const longActionName = 'x'.repeat(1000);
  
  const longFSM = FSM.simple({
    [longStateName]: { [longActionName]: 'B' },
    'B': { 'short': longStateName }
  });
  
  // 긴 이름이 제대로 처리되는지 확인
  assert.strictEqual(longFSM.currentState, longStateName, '매우 긴 상태명이 처리되어야 함');
  assert.ok(longFSM.states.includes(longStateName), '매우 긴 상태명이 상태 목록에 포함되어야 함');
  assert.ok(longFSM.actions.includes(longActionName), '매우 긴 액션명이 액션 목록에 포함되어야 함');
  
  // 긴 이름으로 전이가 제대로 동작하는지 확인
  longFSM.executeAction(longActionName);
  assert.strictEqual(longFSM.currentState, 'B', '긴 액션으로 상태 전이가 성공해야 함');
  
  longFSM.executeAction('short');
  assert.strictEqual(longFSM.currentState, longStateName, '짧은 액션으로 긴 상태로 전이가 성공해야 함');
  
  // 2. 빈 문자열 상태/액션 이름 처리 테스트
  // FSM은 빈 문자열 상태를 허용해서는 안 됨
  assert.throws(() => {
    FSM.simple({
      '': { 'action': 'B' },
      'B': { 'action': 'C' }
    });
  }, /빈 문자열 상태는 허용되지 않아야 함/, '빈 문자열 상태는 예외를 발생시켜야 함');
  
  // 3. null/undefined 값 처리 테스트
  // null 액션 맵 테스트
  assert.throws(() => {
    FSM.simple({
      'A': null,
      'B': { 'action': 'A' }
    });
  }, /null 액션 맵은 허용되지 않아야 함/, 'null 액션 맵은 예외를 발생시켜야 함');
  
  // null 목적 상태 테스트
  assert.throws(() => {
    FSM.simple({
      'A': { 'action': null },
      'B': { 'action': 'A' }
    });
  }, /null 대상 상태는 허용되지 않아야 함/, 'null 대상 상태는 예외를 발생시켜야 함');
  
  // 4. 동일 액션에 대한 다중 전이 정의 테스트 (덮어쓰기 동작 확인)
  const testFSM = new FSM(
    ['A', 'B', 'C'],  // 상태 목록
    ['x'],            // 액션 목록
    new Map([         // 전이 맵
      ['A', new Map([['x', 'B']])],
      ['B', new Map()],
      ['C', new Map()]
    ]),
    'A'               // 초기 상태
  );
  
  // 기존 전이 확인
  testFSM.executeAction('x');
  assert.strictEqual(testFSM.currentState, 'B', '초기 정의된 전이가 동작해야 함');
  
  // 새로운 FSM 생성
  const testFSM2 = new FSM(
    ['A', 'B', 'C'],
    ['x'],
    new Map([
      ['A', new Map([['x', 'B']])],
      ['B', new Map()],
      ['C', new Map()]
    ]),
    'A'
  );
  
  // 전이 덮어쓰기
  testFSM2.addTransition('A', 'x', 'C');
  
  // 새 전이 확인
  testFSM2.executeAction('x');
  assert.strictEqual(testFSM2.currentState, 'C', '덮어쓴 전이가 우선되어야 함');
  
  // 5. 특수 문자를 포함한 상태/액션 이름 테스트
  const specialCharFSM = FSM.simple({
    'state!@#': { 'action$%^': 'state&*(' },
    'state&*(': { 'action)_+': 'state!@#' }
  });
  
  assert.strictEqual(specialCharFSM.currentState, 'state!@#', '특수 문자가 포함된 초기 상태가 설정되어야 함');
  specialCharFSM.executeAction('action$%^');
  assert.strictEqual(specialCharFSM.currentState, 'state&*(', '특수 문자가 포함된 액션으로 전이가 동작해야 함');
});

/**
 * 복잡한 오류 처리 시뮬레이션
 */
runner.addTest('오류 처리 및 복구 시뮬레이션', () => {
  // 1. 오류 처리와 복구 과정을 모델링하는 FSM 정의
  const errorFSM = FSM.simple({
    'idle': { 
      'start': 'processing'
    },
    'processing': { 
      'success': 'success',
      'minor_error': 'error_level_1',
      'major_error': 'error_level_2',
      'critical_error': 'error_level_3'
    },
    'error_level_1': {  // 경미한 오류 - 자동 복구
      'auto_recover': 'processing',
      'abort': 'failed'
    },
    'error_level_2': {  // 중대한 오류 - 수동 복구 필요
      'manual_recover': 'processing',
      'abort': 'failed',
      'escalate': 'error_level_3'
    },
    'error_level_3': {  // 치명적 오류 - 복구 불가
      'abort': 'failed'
    },
    'success': {
      'reset': 'idle'
    },
    'failed': {
      'reset': 'idle'
    }
  });
  
  // 2. 상태 전이 기록을 위한 콜백 설정
  const stateLog = [];
  errorFSM.onTransition((from, action, to) => {
    stateLog.push({ from, action, to });
  });
  
  // 3. 초기 상태 확인
  assert.strictEqual(errorFSM.currentState, 'idle', '초기 상태는 idle이어야 함');
  
  // 4. 시나리오 A: 성공 경로
  errorFSM.executeAction('start');
  errorFSM.executeAction('success');
  assert.strictEqual(errorFSM.currentState, 'success', '작업 성공 시 success 상태가 되어야 함');
  
  errorFSM.executeAction('reset');
  assert.strictEqual(errorFSM.currentState, 'idle', 'reset 후 idle 상태로 돌아가야 함');
  
  // 5. 시나리오 B: 경미한 오류 발생 후 자동 복구
  errorFSM.executeAction('start');
  errorFSM.executeAction('minor_error');
  assert.strictEqual(errorFSM.currentState, 'error_level_1', '경미한 오류 발생 시 error_level_1 상태가 되어야 함');
  
  errorFSM.executeAction('auto_recover');
  assert.strictEqual(errorFSM.currentState, 'processing', '자동 복구 후 processing 상태로 돌아가야 함');
  
  errorFSM.executeAction('success');
  errorFSM.executeAction('reset');
  assert.strictEqual(errorFSM.currentState, 'idle', '작업 완료 후 reset하면 idle 상태가 되어야 함');
  
  // 6. 시나리오 C: 중대한 오류 발생 후 수동 복구
  errorFSM.executeAction('start');
  errorFSM.executeAction('major_error');
  assert.strictEqual(errorFSM.currentState, 'error_level_2', '중대한 오류 발생 시 error_level_2 상태가 되어야 함');
  
  errorFSM.executeAction('manual_recover');
  assert.strictEqual(errorFSM.currentState, 'processing', '수동 복구 후 processing 상태로 돌아가야 함');
  
  errorFSM.executeAction('success');
  errorFSM.executeAction('reset');
  
  // 7. 시나리오 D: 중대한 오류 발생 후 에스컬레이션
  errorFSM.executeAction('start');
  errorFSM.executeAction('major_error');
  errorFSM.executeAction('escalate');
  assert.strictEqual(errorFSM.currentState, 'error_level_3', '에스컬레이션 후 error_level_3 상태가 되어야 함');
  
  errorFSM.executeAction('abort');
  assert.strictEqual(errorFSM.currentState, 'failed', '치명적 오류 abort 후 failed 상태가 되어야 함');
  
  errorFSM.executeAction('reset');
  
  // 8. 시나리오 E: 치명적 오류 직접 발생
  errorFSM.executeAction('start');
  errorFSM.executeAction('critical_error');
  assert.strictEqual(errorFSM.currentState, 'error_level_3', '치명적 오류 발생 시 error_level_3 상태가 되어야 함');
  
  errorFSM.executeAction('abort');
  assert.strictEqual(errorFSM.currentState, 'failed', '치명적 오류 abort 후 failed 상태가 되어야 함');
  
  // 9. 상태 전이 로그 검증
  // 예상되는 전이 횟수 계산
  const expectedTransitions = 21; // 각 시나리오 액션 합계
  assert.strictEqual(stateLog.length, expectedTransitions, `총 ${expectedTransitions}번의 상태 전이가 기록되어야 함`);
  
  // 10. 특정 중요 전이 존재 확인
  const hasTransition = (from, action, to) => 
    stateLog.some(t => t.from === from && t.action === action && t.to === to);
  
  assert.ok(hasTransition('processing', 'minor_error', 'error_level_1'), '경미한 오류 전이가 기록되어야 함');
  assert.ok(hasTransition('error_level_1', 'auto_recover', 'processing'), '자동 복구 전이가 기록되어야 함');
  assert.ok(hasTransition('error_level_2', 'escalate', 'error_level_3'), '오류 에스컬레이션 전이가 기록되어야 함');
  assert.ok(hasTransition('error_level_3', 'abort', 'failed'), '오류 중단(abort) 전이가 기록되어야 함');
});

/**
 * 성능 테스트 - 대규모 FSM
 */
runner.addTest('대규모 FSM 성능', async () => {
  // 다수의 상태와 액션을 가진 큰 FSM 생성
  const stateCount = 100;
  const actionCount = 50;
  
  // 상태 배열 생성
  const states = Array.from({ length: stateCount }, (_, i) => `S${i}`);
  
  // 액션 배열 생성
  const actions = Array.from({ length: actionCount }, (_, i) => `A${i}`);
  
  // 전이 맵 생성
  const transitions = new Map();
  
  for (let i = 0; i < stateCount; i++) {
    const stateTransitions = new Map();
    
    // 각 상태마다 모든 액션에 대한 전이 정의
    for (let j = 0; j < actionCount; j++) {
      // 다음 상태는 현재 상태 번호 + 액션 번호를 상태 수로 나눈 나머지
      const nextStateIndex = (i + j) % stateCount;
      stateTransitions.set(actions[j], states[nextStateIndex]);
    }
    
    transitions.set(states[i], stateTransitions);
  }
  
  // 성능 측정 시작
  const startTime = performance.now();
  
  // FSM 생성
  const largeFSM = new FSM(states, actions, transitions, states[0]);
  
  // FSM 생성 시간 측정
  const createTime = performance.now() - startTime;
  console.log(`대규모 FSM 생성 시간: ${createTime.toFixed(2)} ms`);
  
  // 상태 및 액션 수 확인
  assert.strictEqual(largeFSM.states.length, stateCount, `상태는 ${stateCount}개여야 함`);
  assert.strictEqual(largeFSM.actions.length, actionCount, `액션은 ${actionCount}개여야 함`);
  
  // 전이 실행 성능 측정
  const transitionCount = 1000;
  const transitionStartTime = performance.now();
  
  // 무작위 전이 시퀀스 실행
  for (let i = 0; i < transitionCount; i++) {
    const randomActionIndex = Math.floor(Math.random() * actionCount);
    largeFSM.executeAction(actions[randomActionIndex]);
  }
  
  const transitionTime = performance.now() - transitionStartTime;
  console.log(`${transitionCount}회 전이 실행 시간: ${transitionTime.toFixed(2)} ms`);
  console.log(`평균 전이 실행 시간: ${(transitionTime / transitionCount).toFixed(3)} ms`);
  
  // 다수의 콜백 등록 및 실행 성능 테스트
  const callbackCount = 100;
  let totalCallbackExecutions = 0;
  
  // 콜백 다수 등록
  const removeCallbacks = [];
  for (let i = 0; i < callbackCount; i++) {
    const callback = () => {
      totalCallbackExecutions++;
    };
    removeCallbacks.push(largeFSM.onTransition(callback));
  }
  
  // 콜백 실행 성능 측정
  const callbackStartTime = performance.now();
  
  // 몇 가지 전이 실행
  for (let i = 0; i < 10; i++) {
    largeFSM.executeAction(actions[0]);
  }
  
  const callbackTime = performance.now() - callbackStartTime;
  console.log(`${callbackCount}개 콜백 × 10회 전이 실행 시간: ${callbackTime.toFixed(2)} ms`);
  
  assert.strictEqual(totalCallbackExecutions, callbackCount * 10, '모든 콜백이 실행되어야 함');
  
  // 콜백 제거 성능 측정
  const removeStartTime = performance.now();
  
  // 모든 콜백 제거
  for (const removeCallback of removeCallbacks) {
    removeCallback();
  }
  
  const removeTime = performance.now() - removeStartTime;
  console.log(`${callbackCount}개 콜백 제거 시간: ${removeTime.toFixed(2)} ms`);
  
  // 콜백 제거 확인
  totalCallbackExecutions = 0;
  largeFSM.executeAction(actions[0]);
  assert.strictEqual(totalCallbackExecutions, 0, '모든 콜백이 제거되어야 함');
  
  // 허용 가능한 성능 기준 확인 (환경에 따라 다를 수 있음)
  // 이 테스트는 정확한 값이 아닌 대략적인 성능 측정 용도
  assert.ok(createTime < 1000, 'FSM 생성 시간이 허용 가능한 범위여야 함');
  assert.ok(transitionTime < 1000, '전이 실행 시간이 허용 가능한 범위여야 함');
  assert.ok(callbackTime < 1000, '콜백 실행 시간이 허용 가능한 범위여야 함');
  assert.ok(removeTime < 1000, '콜백 제거 시간이 허용 가능한 범위여야 함');
});

/**
 * 비동기 작업과 함께 FSM 사용 테스트
 */
runner.addTest('비동기 작업과 FSM 사용', async () => {
  // 비동기 작업을 시뮬레이션하는 함수
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // 비동기 프로세스 FSM 정의
  const processFSM = FSM.simple({
    'ready': { 'start': 'processing' },
    'processing': { 'complete': 'completed', 'error': 'failed' },
    'completed': { 'reset': 'ready' },
    'failed': { 'retry': 'processing', 'reset': 'ready' }
  });
  
  // 상태 기록
  const stateHistory = [];
  processFSM.onTransition((from, action, to) => {
    stateHistory.push({ from, action, to, time: Date.now() });
  });
  
  // 초기 상태 확인
  assert.strictEqual(processFSM.currentState, 'ready', '초기 상태는 ready여야 함');
  
  // 비동기 처리 시작
  processFSM.executeAction('start');
  assert.strictEqual(processFSM.currentState, 'processing', '상태가 processing으로 변경되어야 함');
  
  // 비동기 작업 시뮬레이션
  await delay(50);
  
  // 작업 완료 또는 실패 무작위 선택
  const isSuccess = Math.random() > 0.5;
  if (isSuccess) {
    processFSM.executeAction('complete');
    assert.strictEqual(processFSM.currentState, 'completed', '상태가 completed로 변경되어야 함');
  } else {
    processFSM.executeAction('error');
    assert.strictEqual(processFSM.currentState, 'failed', '상태가 failed로 변경되어야 함');
    
    // 재시도
    await delay(30);
    processFSM.executeAction('retry');
    assert.strictEqual(processFSM.currentState, 'processing', '상태가 processing으로 변경되어야 함');
    
    // 두 번째 시도 완료
    await delay(30);
    processFSM.executeAction('complete');
    assert.strictEqual(processFSM.currentState, 'completed', '상태가 completed로 변경되어야 함');
  }
  
  // 초기화
  processFSM.executeAction('reset');
  assert.strictEqual(processFSM.currentState, 'ready', '상태가 ready로 변경되어야 함');
  
  // 비동기 작업 중 여러 액션 병렬 시뮬레이션
  const parallelTasks = 5;
  const results = [];
  
  // 여러 비동기 작업 시작
  for (let i = 0; i < parallelTasks; i++) {
    (async (taskId) => {
      processFSM.executeAction('start');
      await delay(Math.random() * 50);
      
      if (Math.random() > 0.3) {
        processFSM.executeAction('complete');
        results.push({ taskId, result: 'completed' });
      } else {
        processFSM.executeAction('error');
        await delay(10);
        processFSM.executeAction('retry');
        await delay(20);
        processFSM.executeAction('complete');
        results.push({ taskId, result: 'completed after retry' });
      }
    })(i);
  }
  
  // 모든 작업이 완료될 때까지 대기
  await delay(200);
  
  // 최종 상태 확인
  assert.ok(['completed', 'ready'].includes(processFSM.currentState), 
    '최종 상태는 completed 또는 ready여야 함');
  
  // 상태 기록 확인
  assert.ok(stateHistory.length >= parallelTasks, '충분한 상태 전이가 기록되어야 함');
  
  // 첫 번째와 마지막 상태 전이 사이의 시간 확인
  const timeSpan = stateHistory[stateHistory.length - 1].time - stateHistory[0].time;
  assert.ok(timeSpan > 0, '상태 전이가 시간 순서대로 기록되어야 함');
});

/**
 * 데드락 상황 및 리셋 테스트
 */
runner.addTest('데드락 감지 및 상태 리셋', () => {
  // 데드락 가능한 상태 머신 (일부 상태에서 빠져나올 수 없음)
  const deadlockFSM = new FSM(
    ['start', 'running', 'deadlock', 'finish'],
    ['proceed', 'progress', 'complete', 'fail', 'restart', 'skip'],
    new Map([
      ['start', new Map([
        ['proceed', 'running'],
        ['skip', 'finish']
      ])],
      ['running', new Map([
        ['progress', 'running'], // 자기 자신으로의 전이
        ['complete', 'finish'],
        ['fail', 'deadlock']
      ])],
      ['deadlock', new Map()], // 빠져나올 수 없는 상태 (전이 없음)
      ['finish', new Map([
        ['restart', 'start']
      ])]
    ]),
    'start'
  );
  
  // 상태 전이 기록
  const stateLog = [];
  deadlockFSM.onTransition((from, action, to) => {
    stateLog.push({ from, action, to });
  });
  
  // 데드락 상태로 진입
  assert.strictEqual(deadlockFSM.currentState, 'start', '초기 상태는 start여야 함');
  deadlockFSM.executeAction('proceed');
  assert.strictEqual(deadlockFSM.currentState, 'running', '상태가 running으로 변경되어야 함');
  
  // 자기 자신으로의 전이 (무한 루프 가능성)
  let loopCount = 0;
  const maxLoops = 5;
  
  // progress 액션은 running 상태를 유지함 (자기 자신으로의 전이)
  for (let i = 0; i < maxLoops; i++) {
    deadlockFSM.executeAction('progress');
    loopCount++;
    assert.strictEqual(deadlockFSM.currentState, 'running', `${i+1}번 반복 후에도 상태는 running이어야 함`);
  }
  
  assert.strictEqual(loopCount, maxLoops, `${maxLoops}번의 자기 전이가 실행되어야 함`);
  
  // 정상적인 종료 경로
  deadlockFSM.executeAction('complete');
  assert.strictEqual(deadlockFSM.currentState, 'finish', '상태가 finish로 변경되어야 함');
  
  // 데드락 테스트
  deadlockFSM.executeAction('restart');
  assert.strictEqual(deadlockFSM.currentState, 'start', '상태가 start로 돌아가야 함');
  
  deadlockFSM.executeAction('proceed');
  assert.strictEqual(deadlockFSM.currentState, 'running', '상태가 running으로 변경되어야 함');
  
  deadlockFSM.executeAction('fail');
  assert.strictEqual(deadlockFSM.currentState, 'deadlock', '상태가 deadlock으로 변경되어야 함');
  
  // 데드락 상태에서는 가능한 액션이 없음
  const availableActions = deadlockFSM.getAvailableActions();
  assert.strictEqual(availableActions.length, 0, '데드락 상태에서는 가능한 액션이 없어야 함');
  
  // 데드락 감지 시뮬레이션
  const isDeadlock = (fsm) => {
    return fsm.getAvailableActions().length === 0;
  };
  
  assert.strictEqual(isDeadlock(deadlockFSM), true, '데드락 상태가 감지되어야 함');
  
  // 수동 리셋 기능 시뮬레이션
  const resetFSM = (fsm, targetState) => {
    // 새 FSM 객체 생성
    return new FSM(
      ['start', 'running', 'deadlock', 'finish'],
      ['proceed', 'progress', 'complete', 'fail', 'restart', 'skip'],
      new Map([
        ['start', new Map([
          ['proceed', 'running'],
          ['skip', 'finish']
        ])],
        ['running', new Map([
          ['progress', 'running'],
          ['complete', 'finish'],
          ['fail', 'deadlock']
        ])],
        ['deadlock', new Map()],
        ['finish', new Map([
          ['restart', 'start']
        ])]
      ]),
      targetState // 특정 상태로 리셋
    );
  };
  
  // 새 FSM 생성 (리셋 시뮬레이션)
  const resetFsmInstance = resetFSM(deadlockFSM, 'start');
  assert.strictEqual(resetFsmInstance.currentState, 'start', '리셋 후 상태는 start여야 함');
  assert.strictEqual(isDeadlock(resetFsmInstance), false, '리셋 후에는 데드락 상태가 아니어야 함');
});

/**
 * 복잡한 오류 처리 시뮬레이션
 */
runner.addTest('오류 처리 및 복구 시뮬레이션', () => {
  // 1. 오류 처리와 복구 과정을 모델링하는 FSM 정의
  const errorFSM = FSM.simple({
    'idle': { 
      'start': 'processing'
    },
    'processing': { 
      'success': 'success',
      'minor_error': 'error_level_1',
      'major_error': 'error_level_2',
      'critical_error': 'error_level_3'
    },
    'error_level_1': {  // 경미한 오류 - 자동 복구
      'auto_recover': 'processing',
      'abort': 'failed'
    },
    'error_level_2': {  // 중대한 오류 - 수동 복구 필요
      'manual_recover': 'processing',
      'abort': 'failed',
      'escalate': 'error_level_3'
    },
    'error_level_3': {  // 치명적 오류 - 복구 불가
      'abort': 'failed'
    },
    'success': {
      'reset': 'idle'
    },
    'failed': {
      'reset': 'idle'
    }
  });
  
  // 2. 상태 전이 기록을 위한 콜백 설정
  const stateLog = [];
  errorFSM.onTransition((from, action, to) => {
    stateLog.push({ from, action, to });
  });
  
  // 3. 초기 상태 확인
  assert.strictEqual(errorFSM.currentState, 'idle', '초기 상태는 idle이어야 함');
  
  // 4. 시나리오 A: 성공 경로
  errorFSM.executeAction('start');
  errorFSM.executeAction('success');
  assert.strictEqual(errorFSM.currentState, 'success', '작업 성공 시 success 상태가 되어야 함');
  
  errorFSM.executeAction('reset');
  assert.strictEqual(errorFSM.currentState, 'idle', 'reset 후 idle 상태로 돌아가야 함');
  
  // 5. 시나리오 B: 경미한 오류 발생 후 자동 복구
  errorFSM.executeAction('start');
  errorFSM.executeAction('minor_error');
  assert.strictEqual(errorFSM.currentState, 'error_level_1', '경미한 오류 발생 시 error_level_1 상태가 되어야 함');
  
  errorFSM.executeAction('auto_recover');
  assert.strictEqual(errorFSM.currentState, 'processing', '자동 복구 후 processing 상태로 돌아가야 함');
  
  errorFSM.executeAction('success');
  errorFSM.executeAction('reset');
  assert.strictEqual(errorFSM.currentState, 'idle', '작업 완료 후 reset하면 idle 상태가 되어야 함');
  
  // 6. 시나리오 C: 중대한 오류 발생 후 수동 복구
  errorFSM.executeAction('start');
  errorFSM.executeAction('major_error');
  assert.strictEqual(errorFSM.currentState, 'error_level_2', '중대한 오류 발생 시 error_level_2 상태가 되어야 함');
  
  errorFSM.executeAction('manual_recover');
  assert.strictEqual(errorFSM.currentState, 'processing', '수동 복구 후 processing 상태로 돌아가야 함');
  
  errorFSM.executeAction('success');
  errorFSM.executeAction('reset');
  
  // 7. 시나리오 D: 중대한 오류 발생 후 에스컬레이션
  errorFSM.executeAction('start');
  errorFSM.executeAction('major_error');
  errorFSM.executeAction('escalate');
  assert.strictEqual(errorFSM.currentState, 'error_level_3', '에스컬레이션 후 error_level_3 상태가 되어야 함');
  
  errorFSM.executeAction('abort');
  assert.strictEqual(errorFSM.currentState, 'failed', '치명적 오류 abort 후 failed 상태가 되어야 함');
  
  errorFSM.executeAction('reset');
  
  // 8. 시나리오 E: 치명적 오류 직접 발생
  errorFSM.executeAction('start');
  errorFSM.executeAction('critical_error');
  assert.strictEqual(errorFSM.currentState, 'error_level_3', '치명적 오류 발생 시 error_level_3 상태가 되어야 함');
  
  errorFSM.executeAction('abort');
  assert.strictEqual(errorFSM.currentState, 'failed', '치명적 오류 abort 후 failed 상태가 되어야 함');
  
  // 9. 상태 전이 로그 검증
  // 예상되는 전이 횟수 계산
  const expectedTransitions = 21; // 각 시나리오 액션 합계
  assert.strictEqual(stateLog.length, expectedTransitions, `총 ${expectedTransitions}번의 상태 전이가 기록되어야 함`);
  
  // 10. 특정 중요 전이 존재 확인
  const hasTransition = (from, action, to) => 
    stateLog.some(t => t.from === from && t.action === action && t.to === to);
  
  assert.ok(hasTransition('processing', 'minor_error', 'error_level_1'), '경미한 오류 전이가 기록되어야 함');
  assert.ok(hasTransition('error_level_1', 'auto_recover', 'processing'), '자동 복구 전이가 기록되어야 함');
  assert.ok(hasTransition('error_level_2', 'escalate', 'error_level_3'), '오류 에스컬레이션 전이가 기록되어야 함');
  assert.ok(hasTransition('error_level_3', 'abort', 'failed'), '오류 중단(abort) 전이가 기록되어야 함');
});

/**
 * 데드락 감지 및 상태 리셋 테스트
 * FSM이 데드락 상태를 감지하고 적절히 처리할 수 있는지 확인
 */
runner.addTest('데드락 감지 및 상태 리셋', () => {
  // 1. 데드락 가능한 FSM 정의
  // 데드락 상태: 더 이상 전이할 수 없는 상태
  const deadlockFSM = FSM.simple({
    'start': {
      'proceed': 'running',
      'skip': 'finish'
    },
    'running': {
      'progress': 'running',  // 자기 자신으로의 전이
      'complete': 'finish',
      'fail': 'deadlock'      // 데드락 상태로 전이
    },
    'deadlock': {
      // 빠져나올 수 없는 상태 (전이 없음)
    },
    'finish': {
      'restart': 'start'
    }
  });
  
  // 2. 초기 상태 확인
  assert.strictEqual(deadlockFSM.currentState, 'start', '초기 상태는 start여야 함');
  
  // 3. 정상 작동 경로 확인
  deadlockFSM.executeAction('proceed');
  assert.strictEqual(deadlockFSM.currentState, 'running', '상태가 running으로 변경되어야 함');
  
  // 4. 자기 자신으로의 전이 테스트 (무한 루프 가능성)
  // progress 액션은 running 상태를 유지함
  for (let i = 0; i < 3; i++) {
    deadlockFSM.executeAction('progress');
    assert.strictEqual(deadlockFSM.currentState, 'running', 
      `${i+1}번 progress 액션 후에도 상태는 여전히 running이어야 함`);
  }
  
  // 5. 정상 완료 경로 확인
  deadlockFSM.executeAction('complete');
  assert.strictEqual(deadlockFSM.currentState, 'finish', '상태가 finish로 변경되어야 함');
  
  // 6. 재시작 확인
  deadlockFSM.executeAction('restart');
  assert.strictEqual(deadlockFSM.currentState, 'start', '상태가 start로 재설정되어야 함');
  
  // 7. 데드락 상태로 진입 확인
  deadlockFSM.executeAction('proceed');
  deadlockFSM.executeAction('fail');
  assert.strictEqual(deadlockFSM.currentState, 'deadlock', '상태가 deadlock으로 변경되어야 함');
  
  // 8. 데드락 상태 감지 확인
  const availableActions = deadlockFSM.getAvailableActions();
  assert.strictEqual(availableActions.length, 0, '데드락 상태에서는 가능한 액션이 없어야 함');
  
  // 9. 데드락 감지 기능 시뮬레이션
  const isDeadlock = (fsm) => fsm.getAvailableActions().length === 0;
  assert.strictEqual(isDeadlock(deadlockFSM), true, '데드락 상태가 감지되어야 함');
  
  // 10. 리셋 기능 시뮬레이션 (실제 프로덕션 코드에서는 FSM에 직접 추가될 수 있음)
  const resetFSM = (fsm, targetState) => {
    // 새 FSM 객체 생성
    return FSM.simple({
      'start': {
        'proceed': 'running',
        'skip': 'finish'
      },
      'running': {
        'progress': 'running',
        'complete': 'finish',
        'fail': 'deadlock'
      },
      'deadlock': {},
      'finish': {
        'restart': 'start'
      }
    });
  };
  
  // 11. 리셋 후 상태 확인
  const resetFsmInstance = resetFSM(deadlockFSM);
  assert.strictEqual(resetFsmInstance.currentState, 'start', '리셋 후 상태는 start여야 함');
  assert.strictEqual(isDeadlock(resetFsmInstance), false, '리셋 후에는 데드락 상태가 아니어야 함');
});

/**
 * 비동기 작업을 FSM으로 처리하는 테스트
 * 비동기 작업 흐름과 상태 관리, 오류 처리 검증
 */
runner.addTest('비동기 작업 처리 테스트', async () => {
  // 1. 비동기 작업 처리를 위한 상태 기계 정의
  const asyncFSM = FSM.simple({
    'ready': { 
      'process': 'processing'
    },
    'processing': { 
      'complete': 'completed',
      'fail': 'failed'
    },
    'completed': { 
      'reset': 'ready'
    },
    'failed': { 
      'retry': 'processing',
      'reset': 'ready'
    }
  });
  
  // 2. 상태 전이 기록 설정
  const transitions = [];
  asyncFSM.onTransition((from, action, to) => {
    transitions.push({ from, action, to });
  });
  
  // 3. 비동기 처리 함수 모의 구현
  const processData = (data, shouldSucceed = true) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (shouldSucceed) {
          resolve(`처리된 데이터: ${data}`);
        } else {
          reject(new Error(`데이터 처리 실패: ${data}`));
        }
      }, 10); // 짧은 지연으로 비동기 시뮬레이션
    });
  };
  
  // 4. 비동기 작업 처리 로직 구현
  const processAsync = async (data, shouldSucceed = true) => {
    // 초기 상태 확인
    assert.strictEqual(asyncFSM.currentState, 'ready', '초기 상태는 ready여야 함');
    
    try {
      // 처리 시작
      asyncFSM.executeAction('process');
      assert.strictEqual(asyncFSM.currentState, 'processing', '처리 시작 시 processing 상태가 되어야 함');
      
      // 비동기 작업 실행
      const result = await processData(data, shouldSucceed);
      
      // 성공 처리
      asyncFSM.executeAction('complete');
      assert.strictEqual(asyncFSM.currentState, 'completed', '성공 시 completed 상태가 되어야 함');
      
      return result;
    } catch (error) {
      // 실패 처리
      asyncFSM.executeAction('fail');
      assert.strictEqual(asyncFSM.currentState, 'failed', '실패 시 failed 상태가 되어야 함');
      
      throw error;
    }
  };
  
  // 5. 성공 시나리오 테스트
  try {
    const result = await processAsync('테스트 데이터', true);
    assert.ok(result.includes('처리된 데이터'), '성공 시 올바른 결과를 반환해야 함');
  } catch (e) {
    assert.fail('성공 시나리오에서 예외가 발생하지 않아야 함');
  }
  
  // 상태 리셋
  asyncFSM.executeAction('reset');
  assert.strictEqual(asyncFSM.currentState, 'ready', 'reset 후 ready 상태로 돌아가야 함');
  
  // 6. 실패 시나리오 테스트
  try {
    await processAsync('테스트 데이터', false);
    assert.fail('실패 시나리오에서 예외가 발생해야 함');
  } catch (error) {
    assert.ok(error.message.includes('데이터 처리 실패'), '올바른 오류 메시지가 포함되어야 함');
    assert.strictEqual(asyncFSM.currentState, 'failed', '실패 후 failed 상태여야 함');
  }
  
  // 7. 재시도 기능 테스트
  asyncFSM.executeAction('retry');
  assert.strictEqual(asyncFSM.currentState, 'processing', '재시도 시 processing 상태로 돌아가야 함');
  
  // 상태 리셋
  asyncFSM.executeAction('fail'); // 다시 실패 상태로
  asyncFSM.executeAction('reset'); // 초기 상태로 리셋
  
  // 8. 상태 전이 검증
  const expectedTransitions = [
    { from: 'ready', action: 'process', to: 'processing' },
    { from: 'processing', action: 'complete', to: 'completed' },
    { from: 'completed', action: 'reset', to: 'ready' },
    { from: 'ready', action: 'process', to: 'processing' },
    { from: 'processing', action: 'fail', to: 'failed' },
    { from: 'failed', action: 'retry', to: 'processing' },
    { from: 'processing', action: 'fail', to: 'failed' },
    { from: 'failed', action: 'reset', to: 'ready' }
  ];
  
  assert.strictEqual(transitions.length, expectedTransitions.length, `상태 전이 횟수가 ${expectedTransitions.length}여야 함`);
  
  expectedTransitions.forEach((expected, index) => {
    const actual = transitions[index];
    assert.deepStrictEqual(actual, expected, `${index+1}번째 전이가 예상과 일치해야 함`);
  });
});

/**
 * 데드락 감지 및 상태 리셋 테스트
 * FSM이 데드락 상태를 감지하고 리셋을 통해 복구하는 기능 검증
 */
runner.addTest('데드락 감지 및 상태 리셋 테스트', () => {
  // 1. 데드락 가능성이 있는 FSM 정의
  const deadlockFSM = FSM.simple({
    'initial': {
      'move': 'middle'
    },
    'middle': {
      'proceed': 'safe',
      'trap': 'deadlocked'
    },
    'safe': {
      'restart': 'initial'
    },
    'deadlocked': {
      // 이 상태에서는 가능한 액션이 없음 - 데드락 상태
    }
  });
  
  // 2. 데드락 여부 판단 함수
  const isDeadlocked = (fsm) => {
    return Object.keys(fsm.getAvailableActions()).length === 0;
  };
  
  // 3. FSM 리셋 함수 (외부 개입을 통한 복구)
  const resetFSM = (fsm) => {
    // 새로운 FSM 인스턴스를 생성하여 초기 상태로 리셋
    return FSM.simple({
      'initial': {
        'move': 'middle'
      },
      'middle': {
        'proceed': 'safe',
        'trap': 'deadlocked'
      },
      'safe': {
        'restart': 'initial'
      },
      'deadlocked': {
        // 이 상태에서는 가능한 액션이 없음 - 데드락 상태
      }
    });
  };
  
  // 4. 초기 상태 확인
  assert.strictEqual(deadlockFSM.currentState, 'initial', '초기 상태는 initial이어야 함');
  assert.strictEqual(isDeadlocked(deadlockFSM), false, '초기 상태에서는 데드락 상태가 아니어야 함');
  
  // 5. 정상 경로 테스트
  deadlockFSM.executeAction('move');
  assert.strictEqual(deadlockFSM.currentState, 'middle', '첫 번째 전이 후 middle 상태가 되어야 함');
  
  deadlockFSM.executeAction('proceed');
  assert.strictEqual(deadlockFSM.currentState, 'safe', '안전 경로로 진행 시 safe 상태가 되어야 함');
  assert.strictEqual(isDeadlocked(deadlockFSM), false, 'safe 상태에서는 데드락 상태가 아니어야 함');
  
  // 초기 상태로 되돌림
  deadlockFSM.executeAction('restart');
  assert.strictEqual(deadlockFSM.currentState, 'initial', '재시작 후 initial 상태로 돌아가야 함');
  
  // 6. 데드락 상태 진입 테스트
  deadlockFSM.executeAction('move');
  deadlockFSM.executeAction('trap');
  assert.strictEqual(deadlockFSM.currentState, 'deadlocked', '함정 경로로 진행 시 deadlocked 상태가 되어야 함');
  
  // 데드락 상태 확인
  assert.strictEqual(isDeadlocked(deadlockFSM), true, 'deadlocked 상태에서는 데드락 상태여야 함');
  assert.deepStrictEqual(deadlockFSM.getAvailableActions(), [], 'deadlocked 상태에서는 사용 가능한 액션이 없어야 함');
  
  // 7. 사용 가능한 액션이 없을 때 executeAction 호출 테스트
  try {
    deadlockFSM.executeAction('anyAction');
    assert.fail('데드락 상태에서 액션 실행 시 예외가 발생해야 함');
  } catch (error) {
    assert.ok(
      error.message.includes('유효한 액션이 아닙니다') || 
      error.message.includes('not a valid action'), 
      '유효하지 않은 액션 오류 메시지가 포함되어야 함'
    );
  }
  
  // 8. 리셋을 통한 복구 테스트
  const resetFsmInstance = resetFSM(deadlockFSM);
  assert.strictEqual(resetFsmInstance.currentState, 'initial', '리셋 후 initial 상태로 돌아가야 함');
  assert.strictEqual(isDeadlocked(resetFsmInstance), false, '리셋 후에는 데드락 상태가 아니어야 함');
  
  // 9. 리셋 후 정상 작동 확인
  const availableActions = resetFsmInstance.getAvailableActions();
  assert.ok(availableActions.includes('move'), '리셋 후에는 move 액션이 가능해야 함');
  
  resetFsmInstance.executeAction('move');
  assert.strictEqual(resetFsmInstance.currentState, 'middle', '리셋 후 액션 실행이 정상적으로 동작해야 함');
});

/**
 * 비동기 작업 테스트
 */
runner.addTest('비동기 작업과 FSM 사용', async () => {
  // 비동기 작업 처리를 위한 상태 기계
  const asyncFSM = FSM.simple({
    'ready': { 'process': 'processing' },
    'processing': { 'complete': 'completed', 'fail': 'failed' },
    'completed': { 'reset': 'ready' },
    'failed': { 'retry': 'processing', 'reset': 'ready' }
  });
  
  // 상태 변화 기록
  const transitions = [];
  asyncFSM.onTransition((from, action, to) => {
    transitions.push({ from, action, to });
  });
  
  // 비동기 처리 함수 모의 구현
  const processData = (data, shouldSucceed = true) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (shouldSucceed) {
          resolve(`처리된 데이터: ${data}`);
        } else {
          reject(new Error(`데이터 처리 실패: ${data}`));
        }
      }, 10); // 짧은 지연으로 비동기 시뮬레이션
    });
  };
  
  // 비동기 작업 처리 로직
  const processAsync = async (data, shouldSucceed = true) => {
    // 초기 상태 확인
    assert.strictEqual(asyncFSM.currentState, 'ready', '초기 상태는 ready여야 함');
    
    try {
      // 처리 시작
      asyncFSM.executeAction('process');
      assert.strictEqual(asyncFSM.currentState, 'processing', '처리 시작 시 processing 상태가 되어야 함');
      
      // 비동기 작업 실행
      const result = await processData(data, shouldSucceed);
      
      // 성공 처리
      asyncFSM.executeAction('complete');
      assert.strictEqual(asyncFSM.currentState, 'completed', '성공 시 completed 상태가 되어야 함');
      
      return result;
    } catch (error) {
      // 실패 처리
      asyncFSM.executeAction('fail');
      assert.strictEqual(asyncFSM.currentState, 'failed', '실패 시 failed 상태가 되어야 함');
      
      throw error;
    }
  };
  
  // 성공 시나리오 테스트
  try {
    const result = await processAsync('테스트 데이터', true);
    assert.ok(result.includes('처리된 데이터'), '성공 시 올바른 결과를 반환해야 함');
  } catch (e) {
    assert.fail('성공 시나리오에서 예외가 발생하지 않아야 함');
  }
  
  // 상태 리셋
  asyncFSM.executeAction('reset');
  assert.strictEqual(asyncFSM.currentState, 'ready', 'reset 후 ready 상태로 돌아가야 함');
  
  // 실패 시나리오 테스트
  try {
    await processAsync('테스트 데이터', false);
    assert.fail('실패 시나리오에서 예외가 발생해야 함');
  } catch (error) {
    assert.ok(error.message.includes('데이터 처리 실패'), '올바른 오류 메시지가 포함되어야 함');
    assert.strictEqual(asyncFSM.currentState, 'failed', '실패 후 failed 상태여야 함');
  }
  
  // 재시도 기능 테스트
  asyncFSM.executeAction('retry');
  assert.strictEqual(asyncFSM.currentState, 'processing', '재시도 시 processing 상태로 돌아가야 함');
  
  // 상태 전이 로그 확인
  assert.ok(transitions.length > 0, '상태 전이가 기록되어야 함');
  assert.ok(
    transitions.some(t => t.from === 'failed' && t.action === 'retry' && t.to === 'processing'),
    '실패 후 재시도 전이가 기록되어야 함'
  );
});

/**
 * 데드락 감지 및 상태 리셋 테스트
 * FSM이 데드락 상태를 감지하고 리셋을 통해 복구하는 기능 검증
 */
runner.addTest('데드락 감지 및 상태 리셋 테스트', () => {
  // 1. 데드락 가능성이 있는 FSM 정의
  const deadlockFSM = FSM.simple({
    'initial': {
      'move': 'middle'
    },
    'middle': {
      'proceed': 'safe',
      'trap': 'deadlocked'
    },
    'safe': {
      'restart': 'initial'
    },
    'deadlocked': {
      // 이 상태에서는 가능한 액션이 없음 - 데드락 상태
    }
  });
  
  // 2. 데드락 여부 판단 함수
  const isDeadlocked = (fsm) => {
    return Object.keys(fsm.getAvailableActions()).length === 0;
  };
  
  // 3. FSM 리셋 함수 (외부 개입을 통한 복구)
  const resetFSM = (fsm) => {
    // 새로운 FSM 인스턴스를 생성하여 초기 상태로 리셋
    return FSM.simple({
      'initial': {
        'move': 'middle'
      },
      'middle': {
        'proceed': 'safe',
        'trap': 'deadlocked'
      },
      'safe': {
        'restart': 'initial'
      },
      'deadlocked': {
        // 이 상태에서는 가능한 액션이 없음 - 데드락 상태
      }
    });
  };
  
  // 4. 초기 상태 확인
  assert.strictEqual(deadlockFSM.currentState, 'initial', '초기 상태는 initial이어야 함');
  assert.strictEqual(isDeadlocked(deadlockFSM), false, '초기 상태에서는 데드락 상태가 아니어야 함');
  
  // 5. 정상 경로 테스트
  deadlockFSM.executeAction('move');
  assert.strictEqual(deadlockFSM.currentState, 'middle', '첫 번째 전이 후 middle 상태가 되어야 함');
  
  deadlockFSM.executeAction('proceed');
  assert.strictEqual(deadlockFSM.currentState, 'safe', '안전 경로로 진행 시 safe 상태가 되어야 함');
  assert.strictEqual(isDeadlocked(deadlockFSM), false, 'safe 상태에서는 데드락 상태가 아니어야 함');
  
  // 초기 상태로 되돌림
  deadlockFSM.executeAction('restart');
  assert.strictEqual(deadlockFSM.currentState, 'initial', '재시작 후 initial 상태로 돌아가야 함');
  
  // 6. 데드락 상태 진입 테스트
  deadlockFSM.executeAction('move');
  deadlockFSM.executeAction('trap');
  assert.strictEqual(deadlockFSM.currentState, 'deadlocked', '함정 경로로 진행 시 deadlocked 상태가 되어야 함');
  
  // 데드락 상태 확인
  assert.strictEqual(isDeadlocked(deadlockFSM), true, 'deadlocked 상태에서는 데드락 상태여야 함');
  assert.deepStrictEqual(deadlockFSM.getAvailableActions(), [], 'deadlocked 상태에서는 사용 가능한 액션이 없어야 함');
  
  // 7. 사용 가능한 액션이 없을 때 executeAction 호출 테스트
  try {
    deadlockFSM.executeAction('anyAction');
    assert.fail('데드락 상태에서 액션 실행 시 예외가 발생해야 함');
  } catch (error) {
    assert.ok(
      error.message.includes('유효한 액션이 아닙니다') || 
      error.message.includes('not a valid action'), 
      '유효하지 않은 액션 오류 메시지가 포함되어야 함'
    );
  }
  
  // 8. 리셋을 통한 복구 테스트
  const resetFsmInstance = resetFSM(deadlockFSM);
  assert.strictEqual(resetFsmInstance.currentState, 'initial', '리셋 후 initial 상태로 돌아가야 함');
  assert.strictEqual(isDeadlocked(resetFsmInstance), false, '리셋 후에는 데드락 상태가 아니어야 함');
  
  // 9. 리셋 후 정상 작동 확인
  const availableActions = resetFsmInstance.getAvailableActions();
  assert.ok(availableActions.includes('move'), '리셋 후에는 move 액션이 가능해야 함');
  
  resetFsmInstance.executeAction('move');
  assert.strictEqual(resetFsmInstance.currentState, 'middle', '리셋 후 액션 실행이 정상적으로 동작해야 함');
});

// 테스트 실행
runner.run().then(success => {
  // 성공 여부에 따라 종료 코드 설정
  process.exit(success ? 0 : 1);
}); 