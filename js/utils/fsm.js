/**
 * 간단한 유한 상태 기계(FSM) 구현
 */
export class FSM {
  // private 필드
  #states
  #actions
  #transitions
  #currentState
  #onTransitionCallbacks = []

  /**
   * 간단한 객체 표현에서 FSM 인스턴스 생성
   * @param {Object} transitionObject - 상태 전이를 표현하는 객체
   * @returns {FSM} 생성된 FSM 인스턴스
   * @example
   * // 다음과 같은 형태로 사용
   * const trafficLight = FSM.simple({
   *   'red': {'timer': 'green'},
   *   'green': {'timer': 'yellow'},
   *   'yellow': {'timer': 'red'}
   * });
   */
  static simple (transitionObject) {
    const isMap = (o) => o instanceof Map
    const getKeys = (o) => isMap(o) ? Array.from(o.keys()) : Object.keys(o)
    const getValues = (o) => isMap(o) ? Array.from(o.values()) : Object.values(o)
    const getEntries = (o) => isMap(o) ? Array.from(o.entries()) : Object.entries(o)
    const get = (o, k) => isMap(o) ? o.get(k) : o[k]

    if (!transitionObject || typeof transitionObject !== 'object' || getKeys(transitionObject).length === 0) {
      throw new Error('전이 객체는 비어있을 수 없습니다.')
    }

    // 빈 문자열 상태 검사
    if (getKeys(transitionObject).includes('')) {
      throw new Error('빈 문자열 상태는 허용되지 않아야 함')
    }

    // null 액션 맵 검사
    for (const state of getKeys(transitionObject)) {
      if (get(transitionObject, state) === null || get(transitionObject, state) === undefined) {
        throw new Error('null 액션 맵은 허용되지 않아야 함')
      }

      // null 대상 상태 검사
      if (typeof get(transitionObject, state) === 'object') {
        for (const action of getKeys(get(transitionObject, state))) {
          if (get(get(transitionObject, state), action) === null || get(get(transitionObject, state), action) === undefined) {
            throw new Error('null 대상 상태는 허용되지 않아야 함')
          }
        }
      }
    }

    // 상태 추출 (중복 제거)
    const states = new Set()

    // 객체의 키는 상태입니다
    getKeys(transitionObject).forEach(state => states.add(state))

    // 중첩된 객체의 값도 상태입니다
    getValues(transitionObject).forEach(actionMap => {
      getValues(actionMap).forEach(state => states.add(state))
    })

    // 액션 추출 (중복 제거)
    const actions = new Set()
    getValues(transitionObject).forEach(actionMap => {
      getKeys(actionMap).forEach(action => actions.add(action))
    })

    // 전이 맵 생성
    const transitions = new Map()
    getEntries(transitionObject).forEach(([fromState, actionMap]) => {
      const stateTransitions = new Map()
      getEntries(actionMap).forEach(([action, toState]) => {
        stateTransitions.set(action, toState)
      })
      transitions.set(fromState, stateTransitions)
    })

    // 초기 상태는 객체의 첫 번째 키
    const initialState = getKeys(transitionObject)[0]

    // FSM 인스턴스 생성 및 반환
    return new FSM(
      Array.from(states),
      Array.from(actions),
      transitions,
      initialState
    )
  }

  /**
   * FSM 생성자
   * @param {string[]} states - 상태 목록
   * @param {string[]} actions - 액션 목록
   * @param {Map<string, Map<string, string>>} transitions - 상태 전이 맵
   * @param {string} initialState - 초기 상태 (기본값: 첫 번째 상태)
   */
  constructor (states, actions, transitions, initialState = null) {
    // 상태와 액션 목록 복사
    this.#states = [...states]
    this.#actions = [...actions]

    // 상태와 액션 유효성 검사
    if (this.#states.length === 0) {
      throw new Error('상태 목록은 비어있을 수 없습니다.')
    }

    if (this.#actions.length === 0) {
      throw new Error('액션 목록은 비어있을 수 없습니다.')
    }

    // 초기 상태 설정
    this.#currentState = initialState || this.#states[0]

    // 초기 상태 유효성 검사
    if (!this.#states.includes(this.#currentState)) {
      throw new Error(`초기 상태 "${this.#currentState}"가 유효한 상태가 아닙니다.`)
    }

    // 전이 맵 복사 및 유효성 검사
    this.#transitions = new Map()

    // 모든 상태에 대해 전이 맵 초기화
    for (const state of this.#states) {
      this.#transitions.set(state, new Map())
    }

    // 전이 정의 추가
    if (transitions) {
      for (const [fromState, actionMap] of transitions.entries()) {
        if (!this.#states.includes(fromState)) {
          throw new Error(`상태 "${fromState}"가 유효한 상태가 아닙니다.`)
        }

        const transitionMap = this.#transitions.get(fromState)

        for (const [action, toState] of actionMap.entries()) {
          if (!this.#actions.includes(action)) {
            throw new Error(`액션 "${action}"이 유효한 액션이 아닙니다.`)
          }

          if (!this.#states.includes(toState)) {
            throw new Error(`상태 "${toState}"가 유효한 상태가 아닙니다.`)
          }

          transitionMap.set(action, toState)
        }
      }
    }
  }

  /**
   * 현재 상태 반환
   * @returns {string} 현재 상태
   */
  get currentState () {
    return this.#currentState
  }

  /**
   * 상태 목록 반환
   * @returns {string[]} 상태 목록
   */
  get states () {
    return [...this.#states]
  }

  /**
   * 액션 목록 반환
   * @returns {string[]} 액션 목록
   */
  get actions () {
    return [...this.#actions]
  }

  /**
   * 현재 상태에서 가능한 액션 목록 반환
   * @returns {string[]} 가능한 액션 목록
   */
  getAvailableActions () {
    const actionMap = this.#transitions.get(this.#currentState)
    return Array.from(actionMap.keys())
  }

  /**
   * 현재 상태에서 액션 실행
   * @param {string} action - 실행할 액션
   * @returns {boolean} 액션 실행 성공 여부
   */
  executeAction (action) {
    if (!this.#actions.includes(action)) {
      throw new Error(`액션 "${action}"이 유효한 액션이 아닙니다.`)
    }

    const actionMap = this.#transitions.get(this.#currentState)
    const nextState = actionMap.get(action)

    if (!nextState) {
      return false // 현재 상태에서 해당 액션 실행 불가
    }

    const previousState = this.#currentState
    this.#currentState = nextState

    // 전이 콜백 실행
    for (const callback of this.#onTransitionCallbacks) {
      callback(previousState, action, nextState)
    }

    return true
  }

  /**
   * 상태 전이 발생 시 호출될 콜백 함수 등록
   * @param {function(string, string, string)} callback - 콜백 함수
   * @returns {function()} 콜백 제거 함수
   */
  onTransition (callback) {
    this.#onTransitionCallbacks.push(callback)

    // 콜백 제거 함수 반환
    return () => {
      const index = this.#onTransitionCallbacks.indexOf(callback)
      if (index !== -1) {
        this.#onTransitionCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * 전이 맵 반환
   * @returns {Map<string, Map<string, string>>} 전이 맵의 복사본
   */
  getTransitionMap () {
    const transitionMap = new Map()

    for (const [fromState, actionMap] of this.#transitions.entries()) {
      const newActionMap = new Map()

      for (const [action, toState] of actionMap.entries()) {
        newActionMap.set(action, toState)
      }

      transitionMap.set(fromState, newActionMap)
    }

    return transitionMap
  }

  /**
   * 전이 추가
   * @param {string} fromState - 시작 상태
   * @param {string} action - 액션
   * @param {string} toState - 도착 상태
   * @returns {boolean} 추가 성공 여부
   */
  addTransition (fromState, action, toState) {
    if (!this.#states.includes(fromState) ||
        !this.#actions.includes(action) ||
        !this.#states.includes(toState)) {
      return false
    }

    const actionMap = this.#transitions.get(fromState)
    actionMap.set(action, toState)

    return true
  }

  /**
   * 전이 제거
   * @param {string} fromState - 시작 상태
   * @param {string} action - 액션
   * @returns {boolean} 제거 성공 여부
   */
  removeTransition (fromState, action) {
    if (!this.#states.includes(fromState) ||
        !this.#actions.includes(action)) {
      return false
    }

    const actionMap = this.#transitions.get(fromState)
    return actionMap.delete(action)
  }
}
