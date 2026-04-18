<p align="center">
  <a href="https://claude.ai/public/artifacts/14f7c2fa-7cc4-40db-b9f3-f26d969dc477" target="_blank" rel="noopener noreferrer"><img src="taegeukgi.svg" alt="Taegeukgi" height="64" border="1"></a>
</p>
이 게임은 "넘버 게임: 10 만들기"(Number Game: Make 10)라는 격자 기반 퍼즐 게임입니다.
게임 개요:
10×20 크기의 격자판에 1~9 사이의 숫자들이 배치되어 있습니다.
게임의 목표는 직사각형 영역을 선택하여 그 안의 숫자들의 합이 정확히 10이 되도록 하는 것입니다.
합이 10이 되는 영역을 찾아 선택하면 해당 영역의 숫자들이 제거됩니다.
제한 시간 내에 가능한 많은 영역을 찾아 제거하여 높은 점수를 획득하는 것이 목표입니다.
주요 규칙:
선택한 영역은 직사각형 형태여야 합니다.
선택 영역 내 숫자들의 합이 정확히 10이 되어야 합니다.
영역에는 최소 2개 이상의 숫자가 포함되어야 합니다.
모든 숫자를 제거하거나 시간이 종료되면 게임이 끝납니다.
이 게임은 숫자 조합을 찾는 퍼즐 능력과 빠른 패턴 인식 능력을 시험하는 재미있는 게임입니다.

# Timer 클래스

일시 정지 기능과
 이벤트 리스너를 지원하는 타이머 클래스 구현입니다. setTimeout의 대체품으로 사용 가능합니다.

## 특징

- 일시 정지 및 재개 기능
- 다양한 이벤트 리스너 지원 (시작, 일시 정지, 재개, 종료, 초기화)
- setTimeout과 유사한 API로 쉽게 대체 가능
- 체이닝 메서드 지원

## 설치 및 사용 방법

### 파일 가져오기

```javascript
import { Timer, createTimer } from './timer.js';
```

### 기본 사용법

```javascript
// 타이머 생성
const timer = new Timer(() => {
  console.log('타이머가 완료되었습니다!');
}, 5000);

// 타이머 시작
timer.start();

// 타이머 일시 정지
timer.pause();

// 타이머 재개
timer.resume();

// 타이머 초기화
timer.reset();

// 타이머 취소
timer.clear();
```

### 이벤트 리스너 사용

```javascript
const timer = new Timer(callback, delay);

// 이벤트 리스너 등록 (체이닝 메서드)
timer.onStart(() => console.log('타이머 시작됨'))
     .onPause(() => console.log('타이머 일시 정지됨'))
     .onResume(() => console.log('타이머 재개됨'))
     .onEnd(() => console.log('타이머 종료됨'))
     .onReset(() => console.log('타이머 초기화됨'));

// 개별 이벤트 리스너 등록
timer.on('start', () => console.log('타이머 시작됨'));
```

### 타이머 상태 확인

```javascript
// 현재 타이머 상태 확인
const state = timer.getState(); // 'idle', 'running', 'paused', 'completed' 중 하나 반환

// 남은 시간 확인
const timeRemaining = timer.getTimeRemaining();
```

## API 설명

### 생성자

- `new Timer(callback, delay)`: 타이머 생성. callback은 타이머 종료 시 실행할 함수, delay는 지연 시간(ms)

### 메서드

- `start()`: 타이머 시작
- `pause()`: 타이머 일시 정지
- `resume()`: 타이머 재개
- `reset()`: 타이머 초기화
- `clear()`: 타이머 취소
- `getState()`: 현재 타이머 상태 반환
- `getTimeRemaining()`: 남은 시간 반환
- `on(event, callback)`: 이벤트 리스너 등록
- `onStart(callback)`: 시작 이벤트 리스너 등록
- `onPause(callback)`: 일시 정지 이벤트 리스너 등록
- `onResume(callback)`: 재개 이벤트 리스너 등록
- `onEnd(callback)`: 종료 이벤트 리스너 등록
- `onReset(callback)`: 초기화 이벤트 리스너 등록

## 게임 코드 통합 예시

기존 게임 코드의 타이머 기능을 Timer 클래스로 대체하는 예시는 `timerIntegrationExample.js` 파일을 참조하세요. 
주요 변경 사항은 다음과 같습니다:

1. setTimeout 대신 Timer 클래스 사용
2. 일시 정지/재개 기능 개선
3. 이벤트 리스너를 통한 상태 관리 추가

## 예제 파일

- `timer.js`: Timer 클래스 구현
- `timerExample.js`: 기본 사용 예시
- `timerIntegrationExample.js`: 게임 코드 통합 예시

# JavaScript Enum 구현

JavaScript에서 Symbol을 사용한 강력한 열거형(Enum) 구현입니다. 이 라이브러리는 Java나 TypeScript의 enum과 유사한 기능을 제공하며, 타입 안전성과 값 비교 기능을 갖추고 있습니다.

## 특징

- **고유한 값**: Symbol을 사용하여 각 Enum 값의 고유성 보장
- **싱글톤 패턴**: 모든 Enum 값은 싱글톤으로 구현되어 참조 비교(`===`) 가능
- **타입 안전성**: 서로 다른 Enum 타입 간의 비교 방지
- **값 연결**: 각 Enum 값에 원시값 또는 객체 연결 가능
- **값 목록 조회**: 같은 타입의 모든 Enum 값 조회 가능
- **직렬화 지원**: JSON 직렬화 및 문자열/숫자 변환 지원
- **진정한 private 필드**: 모든 내부 상태는 # 접두사를 사용한 private 필드로 구현
- **instanceof 지원**: Enum 값이 특정 Enum 타입의 인스턴스인지 확인 가능

## 설치 및 사용 방법

### 파일 가져오기

```javascript
import createEnum from './enum.js';
```

### 기본 열거형 생성

```javascript
// 이름만 있는 기본 열거형
const Color = createEnum('Color', ['RED', 'GREEN', 'BLUE']);

// 값이 있는 열거형
const HttpStatus = createEnum('HttpStatus', {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
});

// 복잡한 값을 가진 열거형
const Direction = createEnum('Direction', {
  NORTH: { x: 0, y: 1 },
  EAST: { x: 1, y: 0 },
  SOUTH: { x: 0, y: -1 },
  WEST: { x: -1, y: 0 }
});
```

### Enum 값 접근

```javascript
// 값 접근
const red = Color.RED;
console.log(red.name);    // 'RED'
console.log(red.ordinal); // 0
console.log(red.value);   // 'RED'
console.log(red.type);    // 'Color'

// 값이 있는 열거형
console.log(HttpStatus.OK.value); // 200

// 복잡한 값
const north = Direction.NORTH;
console.log(north.value.x); // 0
console.log(north.value.y); // 1
```

### 값 비교

```javascript
// 참조 비교 (권장)
if (color === Color.RED) {
  console.log('색상은 빨강입니다.');
}

// equals 메서드 사용
if (color.equals(Color.RED)) {
  console.log('색상은 빨강입니다.');
}

// instanceof 연산자로 타입 확인
if (color instanceof Color) {
  console.log('Color 타입의 값입니다.');
}
```

### 값 목록 조회

```javascript
// Enum 타입에서 모든 값 조회
const allColors = Color.values();
console.log(allColors); // [Color.RED, Color.GREEN, Color.BLUE]

// 개별 Enum 값에서 같은 타입의 모든 값 조회
const allColorsFromRed = Color.RED.values();
console.log(allColorsFromRed); // [Color.RED, Color.GREEN, Color.BLUE]

// 값 순회
Color.values().forEach(color => {
  console.log(`${color.name}: ${color.value}`);
});
```

### 값 조회

```javascript
// 이름으로 값 조회
const ok = HttpStatus.valueOf('OK');
console.log(ok === HttpStatus.OK); // true

// 값으로 Enum 조회
const notFound = HttpStatus.fromValue(404);
console.log(notFound === HttpStatus.NOT_FOUND); // true
```

### 변환 및 직렬화

```javascript
// 문자열 변환
console.log(String(Color.RED)); // 'Color.RED'

// 숫자 변환 (ordinal 값 반환)
console.log(Number(Color.GREEN)); // 1

// JSON 직렬화
console.log(JSON.stringify(Color.BLUE)); // '"BLUE"'
console.log(JSON.stringify([Color.RED, Color.GREEN])); // '["RED","GREEN"]'
```

## API 참조

### createEnum(typeName, values)

새로운 Enum 타입을 생성합니다.

- `typeName`: Enum 타입 이름 (문자열)
- `values`: Enum 값 정의 (배열 또는 객체)
  - 배열: 이름만 있는 Enum 값 생성
  - 객체: 이름-값 쌍으로 Enum 값 생성
- 반환값: 생성된 Enum 객체

### Enum 클래스

- `values()`: 모든 Enum 값 배열 반환
- `valueOf(name)`: 이름으로 Enum 값 조회
- `fromValue(value)`: 값으로 Enum 값 조회
- `typeName`: Enum 타입 이름
- `toString()`: Enum 타입의 문자열 표현
- `static [Symbol.hasInstance]`: instanceof 연산자 지원을 위한 구현

### EnumValue 클래스

- `name`: Enum 값 이름
- `ordinal`: Enum 값 순서 (0부터 시작)
- `value`: Enum 값에 연결된 값
- `type`: Enum 타입 이름
- `values()`: 같은 타입의 모든 Enum 값 배열 반환
- `equals(other)`: 두 Enum 값이 같은지 비교
- `toString()`: Enum 값의 문자열 표현
- `toJSON()`: JSON 직렬화 시 사용되는 값

## 실제 사용 예시

### HTTP 상태 코드 처리

```javascript
const HttpStatus = createEnum('HttpStatus', {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
});

function handleResponse(status) {
  if (status === HttpStatus.OK) {
    console.log('요청이 성공적으로 처리되었습니다.');
  } else if (status === HttpStatus.NOT_FOUND) {
    console.log('요청한 리소스를 찾을 수 없습니다.');
  } else if (status instanceof HttpStatus) {
    console.log('다른 상태 코드: ' + status.value);
  } else {
    console.log('알 수 없는 상태 코드');
  }
}

handleResponse(HttpStatus.OK);
```

### 방향 처리

```javascript
const Direction = createEnum('Direction', {
  NORTH: { x: 0, y: 1 },
  EAST: { x: 1, y: 0 },
  SOUTH: { x: 0, y: -1 },
  WEST: { x: -1, y: 0 }
});

function move(direction, steps = 1) {
  const { x, y } = direction.value;
  console.log(`${direction.name} 방향으로 ${steps}칸 이동: (${x * steps}, ${y * steps})`);
}

move(Direction.NORTH, 3);
```

### 요일 처리

```javascript
const DayOfWeek = createEnum('DayOfWeek', [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
]);

function isWeekend(day) {
  return day === DayOfWeek.SATURDAY || day === DayOfWeek.SUNDAY;
}

console.log(isWeekend(DayOfWeek.MONDAY));    // false
console.log(isWeekend(DayOfWeek.SATURDAY));  // true
```

### 타입 검사

```javascript
function processColor(color) {
  if (color instanceof Color) {
    console.log(`유효한 색상입니다: ${color}`);
    return true;
  } else {
    console.log(`유효하지 않은 색상입니다: ${color}`);
    return false;
  }
}

processColor(Color.RED);   // 유효한 색상입니다: Color.RED
processColor(HttpStatus.OK); // 유효하지 않은 색상입니다: HttpStatus.OK
processColor('red');       // 유효하지 않은 색상입니다: red
```

## 제한사항

- Enum 값 이름은 대문자로 시작하는 영문자, 숫자, 언더스코어만 사용 가능합니다.
- 생성 후 Enum 타입과 값은 불변(immutable)입니다.
- 런타임에 새로운 Enum 값을 추가할 수 없습니다.
- 복잡한 객체 값을 가진 Enum을 `fromValue`로 조회할 때는 정확한 참조가 아닌 JSON 문자열 비교를 사용합니다.
- 타입 확인은 `instanceof` 연산자만 사용해야 합니다.

## 예제 파일

- `enum.js`: Enum 클래스 구현
- `enumExample.js`: 사용 예시 

# JavaScript 유한 상태 기계(FSM) 구현

자바스크립트로 구현된 간단하고 강력한 유한 상태 기계(Finite State Machine, FSM) 라이브러리입니다. 상태 기반 로직이 필요한 애플리케이션에서 사용하기 적합합니다.

## 특징

- **직관적인 API**: 상태, 액션, 전이를 명확하게 정의할 수 있는 간단한 API 제공
- **안전한 상태 전이**: 정의된 전이 규칙에 따라서만 상태 변경 가능
- **이벤트 기반**: 상태 변경 시 콜백 함수를 통한 알림 지원
- **런타임 확장성**: 실행 중에 전이 규칙 추가 또는 제거 가능
- **Private 필드**: 최신 자바스크립트 기능을 활용한 안전한 내부 상태 보호
- **가능한 액션 조회**: 현재 상태에서 수행 가능한 액션 목록 제공

## 설치 및 사용 방법

### 파일 가져오기

```javascript
import FSM from './fsm.js';
```

### 기본 사용법

```javascript
// 상태와 액션 정의
const states = ['STATE1', 'STATE2', 'STATE3'];
const actions = ['ACTION1', 'ACTION2', 'ACTION3'];

// 전이 맵 정의
const transitions = new Map();

// STATE1에서의 전이
const state1Transitions = new Map();
state1Transitions.set('ACTION1', 'STATE2');
transitions.set('STATE1', state1Transitions);

// STATE2에서의 전이
const state2Transitions = new Map();
state2Transitions.set('ACTION2', 'STATE3');
state2Transitions.set('ACTION3', 'STATE1');
transitions.set('STATE2', state2Transitions);

// STATE3에서의 전이
const state3Transitions = new Map();
state3Transitions.set('ACTION3', 'STATE1');
transitions.set('STATE3', state3Transitions);

// FSM 생성
const fsm = new FSM(states, actions, transitions, 'STATE1');

// 상태 전이 콜백 등록
fsm.onTransition((fromState, action, toState) => {
  console.log(`${fromState} -> ${action} -> ${toState}`);
});

// 현재 상태 확인
console.log(fsm.currentState);  // STATE1

// 액션 실행
fsm.executeAction('ACTION1');  // STATE1 -> ACTION1 -> STATE2
```

## API 참조

### 생성자

```javascript
new FSM(states, actions, transitions, initialState)
```

- `states`: 상태 목록 (문자열 배열)
- `actions`: 액션 목록 (문자열 배열)
- `transitions`: 상태 전이 맵 (Map<State, Map<Action, State>>)
- `initialState`: 초기 상태 (기본값: 첫 번째 상태)

### 속성

- `currentState`: 현재 상태 (읽기 전용)
- `states`: 상태 목록 (읽기 전용)
- `actions`: 액션 목록 (읽기 전용)

### 메서드

#### executeAction(action)

현재 상태에서 지정된 액션을 실행합니다.

- `action`: 실행할 액션
- 반환값: 액션 실행 성공 여부 (boolean)

```javascript
fsm.executeAction('ACTION1');
```

#### getAvailableActions()

현재 상태에서 사용 가능한 액션 목록을 반환합니다.

- 반환값: 사용 가능한 액션 배열

```javascript
const availableActions = fsm.getAvailableActions();
```

#### onTransition(callback)

상태 전이 발생 시 호출될 콜백 함수를 등록합니다.

- `callback`: (fromState, action, toState) 파라미터를 받는 함수
- 반환값: 콜백 제거 함수

```javascript
const removeCallback = fsm.onTransition((from, action, to) => {
  console.log(`상태 변경: ${from} -> ${to} (액션: ${action})`);
});

// 나중에 콜백 제거
removeCallback();
```

#### transitionTo(state)

지정된 상태로 직접 전환합니다. (일반적으로 권장되지 않음)

- `state`: 전환할 상태
- 반환값: 전환 성공 여부 (boolean)

```javascript
fsm.transitionTo('STATE3');
```

#### getTransitionMap()

현재 전이 맵의 복사본을 반환합니다.

- 반환값: 전이 맵 (Map<State, Map<Action, State>>)

```javascript
const transitionMap = fsm.getTransitionMap();
```

#### addTransition(fromState, action, toState)

새로운 전이 규칙을 추가합니다.

- `fromState`: 시작 상태
- `action`: 액션
- `toState`: 도착 상태
- 반환값: 추가 성공 여부 (boolean)

```javascript
fsm.addTransition('STATE3', 'ACTION2', 'STATE1');
```

#### removeTransition(fromState, action)

기존 전이 규칙을 제거합니다.

- `fromState`: 시작 상태
- `action`: 액션
- 반환값: 제거 성공 여부 (boolean)

```javascript
fsm.removeTransition('STATE2', 'ACTION2');
```

## 사용 예시

### 신호등 제어

```javascript
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
  console.log(`신호등: ${fromState} -> ${toState}`);
});

// 상태 기계 실행
trafficLight.executeAction('TIMER');  // RED -> GREEN
trafficLight.executeAction('TIMER');  // GREEN -> YELLOW
trafficLight.executeAction('TIMER');  // YELLOW -> RED
```

### 문서 워크플로우

```javascript
// 상태 정의
const states = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'];

// 액션 정의
const actions = ['SUBMIT', 'APPROVE', 'REJECT', 'PUBLISH'];

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

// FSM 생성
const documentWorkflow = new FSM(states, actions, transitions, 'DRAFT');

// 문서 처리
documentWorkflow.executeAction('SUBMIT');   // DRAFT -> REVIEW
documentWorkflow.executeAction('APPROVE');  // REVIEW -> APPROVED
documentWorkflow.executeAction('PUBLISH');  // APPROVED -> PUBLISHED
```

## 제한사항

- 상태와 액션은 문자열이어야 합니다.
- 상태나 액션이 추가되면 전이 맵도 업데이트해야 합니다.
- 복잡한 중첩 상태(nested states)는 지원하지 않습니다.

## 예제 파일

- `fsm.js`: FSM 클래스 구현
- `fsmExample.js`: 사용 예시 
