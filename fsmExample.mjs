// FSM 클래스 사용 예제
import FSM from './fsm.mjs';

// 1. 신호등 예제
function trafficLightExample() {
  console.log('===== 신호등 예제 =====');
  
  // 상태 정의
  const states = ['RED', 'GREEN', 'YELLOW'];
  
  // 액션 정의
  const actions = ['TIMER', 'EMERGENCY'];
  
  // 전이 맵 정의
  const transitions = new Map();
  
  // RED 상태에서의 전이
  const redTransitions = new Map();
  redTransitions.set('TIMER', 'GREEN');
  redTransitions.set('EMERGENCY', 'RED');
  transitions.set('RED', redTransitions);
  
  // GREEN 상태에서의 전이
  const greenTransitions = new Map();
  greenTransitions.set('TIMER', 'YELLOW');
  greenTransitions.set('EMERGENCY', 'RED');
  transitions.set('GREEN', greenTransitions);
  
  // YELLOW 상태에서의 전이
  const yellowTransitions = new Map();
  yellowTransitions.set('TIMER', 'RED');
  yellowTransitions.set('EMERGENCY', 'RED');
  transitions.set('YELLOW', yellowTransitions);
  
  // FSM 생성
  const trafficLight = new FSM(states, actions, transitions, 'RED');
  
  // 상태 변화 콜백 등록
  trafficLight.onTransition((fromState, action, toState) => {
    console.log(`신호등: ${fromState} --[${action}]--> ${toState}`);
  });
  
  // 상태 기계 실행
  console.log('초기 상태:', trafficLight.currentState);
  
  trafficLight.executeAction('TIMER');  // RED -> GREEN
  trafficLight.executeAction('TIMER');  // GREEN -> YELLOW
  trafficLight.executeAction('TIMER');  // YELLOW -> RED
  trafficLight.executeAction('EMERGENCY');  // RED -> RED
  
  console.log('가능한 액션:', trafficLight.getAvailableActions());
  
  // 직접 상태 변경 (일반적으로는 사용하지 않음)
  trafficLight.transitionTo('GREEN');
  console.log('현재 상태:', trafficLight.currentState);
}

// 2. 문서 처리 워크플로우 예제
function documentWorkflowExample() {
  console.log('\n===== 문서 처리 워크플로우 예제 =====');
  
  // 상태 정의
  const states = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'];
  
  // 액션 정의
  const actions = ['SUBMIT', 'APPROVE', 'REJECT', 'PUBLISH', 'ARCHIVE'];
  
  // 전이 맵 정의
  const transitions = new Map();
  
  // DRAFT 상태에서의 전이
  const draftTransitions = new Map();
  draftTransitions.set('SUBMIT', 'REVIEW');
  transitions.set('DRAFT', draftTransitions);
  
  // REVIEW 상태에서의 전이
  const reviewTransitions = new Map();
  reviewTransitions.set('APPROVE', 'APPROVED');
  reviewTransitions.set('REJECT', 'DRAFT');
  transitions.set('REVIEW', reviewTransitions);
  
  // APPROVED 상태에서의 전이
  const approvedTransitions = new Map();
  approvedTransitions.set('PUBLISH', 'PUBLISHED');
  approvedTransitions.set('REJECT', 'DRAFT');
  transitions.set('APPROVED', approvedTransitions);
  
  // PUBLISHED 상태에서의 전이
  const publishedTransitions = new Map();
  publishedTransitions.set('ARCHIVE', 'ARCHIVED');
  transitions.set('PUBLISHED', publishedTransitions);
  
  // ARCHIVED 상태에서의 전이 (없음)
  transitions.set('ARCHIVED', new Map());
  
  // FSM 생성
  const documentWorkflow = new FSM(states, actions, transitions, 'DRAFT');
  
  // 상태 변화 콜백 등록
  documentWorkflow.onTransition((fromState, action, toState) => {
    console.log(`문서: ${fromState} --[${action}]--> ${toState}`);
  });
  
  // 문서 처리 시뮬레이션
  console.log('초기 상태:', documentWorkflow.currentState);
  console.log('가능한 액션:', documentWorkflow.getAvailableActions());
  
  documentWorkflow.executeAction('SUBMIT');   // DRAFT -> REVIEW
  console.log('가능한 액션:', documentWorkflow.getAvailableActions());
  
  documentWorkflow.executeAction('REJECT');   // REVIEW -> DRAFT
  documentWorkflow.executeAction('SUBMIT');   // DRAFT -> REVIEW
  documentWorkflow.executeAction('APPROVE');  // REVIEW -> APPROVED
  documentWorkflow.executeAction('PUBLISH');  // APPROVED -> PUBLISHED
  documentWorkflow.executeAction('ARCHIVE');  // PUBLISHED -> ARCHIVED
  
  // 보관된 문서는 더 이상 액션을 수행할 수 없음
  console.log('현재 상태:', documentWorkflow.currentState);
  console.log('가능한 액션:', documentWorkflow.getAvailableActions());
  
  // 허용되지 않는 액션 시도
  const result = documentWorkflow.executeAction('PUBLISH');
  console.log('액션 실행 결과:', result);  // false (실패)
  
  // 런타임에 새 전이 추가
  documentWorkflow.addTransition('ARCHIVED', 'PUBLISH', 'PUBLISHED');
  console.log('새 전이 추가 후 가능한 액션:', documentWorkflow.getAvailableActions());
  
  // 이제 PUBLISH 액션 실행 가능
  documentWorkflow.executeAction('PUBLISH');  // ARCHIVED -> PUBLISHED
}

// 3. 게임 캐릭터 상태 예제
function gameCharacterExample() {
  console.log('\n===== 게임 캐릭터 상태 예제 =====');
  
  // 상태 정의
  const states = ['IDLE', 'WALKING', 'RUNNING', 'JUMPING', 'ATTACKING', 'DAMAGED', 'DEAD'];
  
  // 액션 정의
  const actions = ['WALK', 'RUN', 'STOP', 'JUMP', 'ATTACK', 'TAKE_DAMAGE', 'DIE'];
  
  // 전이 맵 정의
  const transitions = new Map();
  
  // IDLE 상태에서의 전이
  const idleTransitions = new Map();
  idleTransitions.set('WALK', 'WALKING');
  idleTransitions.set('RUN', 'RUNNING');
  idleTransitions.set('JUMP', 'JUMPING');
  idleTransitions.set('ATTACK', 'ATTACKING');
  idleTransitions.set('TAKE_DAMAGE', 'DAMAGED');
  idleTransitions.set('DIE', 'DEAD');
  transitions.set('IDLE', idleTransitions);
  
  // WALKING 상태에서의 전이
  const walkingTransitions = new Map();
  walkingTransitions.set('STOP', 'IDLE');
  walkingTransitions.set('RUN', 'RUNNING');
  walkingTransitions.set('JUMP', 'JUMPING');
  walkingTransitions.set('ATTACK', 'ATTACKING');
  walkingTransitions.set('TAKE_DAMAGE', 'DAMAGED');
  walkingTransitions.set('DIE', 'DEAD');
  transitions.set('WALKING', walkingTransitions);
  
  // RUNNING 상태에서의 전이
  const runningTransitions = new Map();
  runningTransitions.set('STOP', 'IDLE');
  runningTransitions.set('WALK', 'WALKING');
  runningTransitions.set('JUMP', 'JUMPING');
  runningTransitions.set('ATTACK', 'ATTACKING');
  runningTransitions.set('TAKE_DAMAGE', 'DAMAGED');
  runningTransitions.set('DIE', 'DEAD');
  transitions.set('RUNNING', runningTransitions);
  
  // JUMPING 상태에서의 전이
  const jumpingTransitions = new Map();
  jumpingTransitions.set('STOP', 'IDLE');
  jumpingTransitions.set('ATTACK', 'ATTACKING');
  jumpingTransitions.set('TAKE_DAMAGE', 'DAMAGED');
  jumpingTransitions.set('DIE', 'DEAD');
  transitions.set('JUMPING', jumpingTransitions);
  
  // ATTACKING 상태에서의 전이
  const attackingTransitions = new Map();
  attackingTransitions.set('STOP', 'IDLE');
  attackingTransitions.set('WALK', 'WALKING');
  attackingTransitions.set('RUN', 'RUNNING');
  attackingTransitions.set('JUMP', 'JUMPING');
  attackingTransitions.set('TAKE_DAMAGE', 'DAMAGED');
  attackingTransitions.set('DIE', 'DEAD');
  transitions.set('ATTACKING', attackingTransitions);
  
  // DAMAGED 상태에서의 전이
  const damagedTransitions = new Map();
  damagedTransitions.set('STOP', 'IDLE');
  damagedTransitions.set('DIE', 'DEAD');
  transitions.set('DAMAGED', damagedTransitions);
  
  // DEAD 상태에서의 전이 (없음)
  transitions.set('DEAD', new Map());
  
  // FSM 생성
  const characterFSM = new FSM(states, actions, transitions, 'IDLE');
  
  // 상태 변화 콜백 등록
  characterFSM.onTransition((fromState, action, toState) => {
    console.log(`캐릭터: ${fromState} --[${action}]--> ${toState}`);
  });
  
  // 게임 캐릭터 시뮬레이션
  console.log('초기 상태:', characterFSM.currentState);
  
  characterFSM.executeAction('WALK');       // IDLE -> WALKING
  characterFSM.executeAction('RUN');        // WALKING -> RUNNING
  characterFSM.executeAction('JUMP');       // RUNNING -> JUMPING
  characterFSM.executeAction('ATTACK');     // JUMPING -> ATTACKING
  characterFSM.executeAction('TAKE_DAMAGE'); // ATTACKING -> DAMAGED
  characterFSM.executeAction('DIE');        // DAMAGED -> DEAD
  
  // DEAD 상태에서는 더 이상 액션을 수행할 수 없음
  console.log('현재 상태:', characterFSM.currentState);
  console.log('가능한 액션:', characterFSM.getAvailableActions());
}

// 모든 예제 실행
function runAllExamples() {
  trafficLightExample();
  documentWorkflowExample();
  gameCharacterExample();
}

// 예제 실행
runAllExamples(); 