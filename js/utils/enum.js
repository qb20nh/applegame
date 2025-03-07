/**
 * enum.js - Symbol을 사용한 JavaScript 열거형(Enum) 구현
 * 
 * 이 모듈은 JavaScript에서 Symbol을 사용하여 고유한 열거형(Enum)을 구현합니다.
 * 모든 Enum 값은 싱글톤이며, 같은 타입의 모든 가능한 Enum 값을 나열하고
 * 서로 다른 Enum 값의 타입을 비교할 수 있습니다.
 */

/**
 * 모든 Enum 타입을 저장하는 Map
 * @type {Map<string, Enum>}
 */
const enumTypes = new Map();

/**
 * Enum 값 클래스
 */
class EnumValue {
  // private 필드
  #type;
  #name;
  #ordinal;
  #value;
  #symbol;

  /**
   * Enum 값 생성자
   * @param {string} type - Enum 타입 이름
   * @param {string} name - Enum 값 이름
   * @param {number} ordinal - Enum 값 순서
   * @param {*} value - Enum 값
   */
  constructor(type, name, ordinal, value) {
    this.#type = type;
    this.#name = name;
    this.#ordinal = ordinal;
    this.#value = value;
    this.#symbol = Symbol(`${type}.${name}`);
  }

  /**
   * Enum 타입 이름 getter
   * @returns {string} Enum 타입 이름
   */
  get type() {
    return this.#type;
  }

  /**
   * Enum 값 이름 getter
   * @returns {string} Enum 값 이름
   */
  get name() {
    return this.#name;
  }

  /**
   * Enum 값 순서 getter
   * @returns {number} Enum 값 순서
   */
  get ordinal() {
    return this.#ordinal;
  }

  /**
   * Enum 값 getter
   * @returns {*} Enum 값
   */
  get value() {
    return this.#value;
  }

  /**
   * 같은 타입의 모든 Enum 값 반환
   * @returns {EnumValue[]} 같은 타입의 모든 Enum 값 배열
   */
  values() {
    const enumType = enumTypes.get(this.#type);
    return enumType ? enumType.values() : [];
  }

  /**
   * 두 Enum 값이 같은지 비교
   * @param {EnumValue} other - 비교할 Enum 값
   * @returns {boolean} 두 Enum 값이 같으면 true, 아니면 false
   */
  equals(other) {
    if (!(other instanceof EnumValue)) {
      return false;
    }
    return this.#symbol === other.#symbol;
  }

  /**
   * Enum 값의 문자열 표현
   * @returns {string} Enum 값의 문자열 표현
   */
  toString() {
    return `${this.#type}.${this.#name}`;
  }

  /**
   * Enum 값의 JSON 표현
   * @returns {*} JSON 표현 시 사용할 값
   */
  toJSON() {
    return this.#name;
  }

  /**
   * Symbol.toPrimitive 구현
   * @param {string} hint - 변환 힌트
   * @returns {string|number} 문자열 또는 숫자 표현
   */
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') {
      return this.#ordinal;
    }
    return this.toString();
  }
}

/**
 * Enum 클래스
 */
class Enum {
  // private 필드
  #typeName;
  #values = [];
  #nameToValue = new Map();
  #valueToEnum = new Map();

  /**
   * instanceof 연산자 구현
   * @param {any} instance - 검사할 인스턴스
   * @returns {boolean} 인스턴스가 이 Enum 타입이면 true, 아니면 false
   */
  static [Symbol.hasInstance](instance) {
    if (!(instance instanceof EnumValue)) {
      return false;
    }
    
    // this는 Enum 객체 생성자가 됨
    if (!this.prototype.constructor.name === 'Enum') {
      return false;
    }
    
    // this.typeName에 직접 접근할 수 없으므로 enumTypes에서 조회
    // enumTypes의 모든 키(Enum 타입 이름)를 순회하며 this가 해당 Enum 타입인지 확인
    for (const [typeName, enumInstance] of enumTypes.entries()) {
      if (enumInstance === this && typeName === instance.type) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Enum 생성자
   * @param {string} typeName - Enum 타입 이름
   * @param {string[]|Object} values - Enum 값 이름 배열 또는 이름-값 객체
   */
  constructor(typeName, values) {
    if (enumTypes.has(typeName)) {
      throw new Error(`Enum type '${typeName}' already exists`);
    }

    this.#typeName = typeName;
    
    if (Array.isArray(values)) {
      this.#createFromArray(values);
    } else if (typeof values === 'object' && values !== null) {
      this.#createFromObject(values);
    } else {
      throw new Error('Values must be an array or an object');
    }

    // Map에 타입 등록
    enumTypes.set(typeName, this);
    
    // 모든 속성을 읽기 전용으로 설정
    Object.freeze(this);
  }

  /**
   * 배열에서 Enum 값 생성
   * @param {string[]} names - Enum 값 이름 배열
   */
  #createFromArray(names) {
    names.forEach((name, index) => {
      this.#addValue(name, name, index);
    });
  }

  /**
   * 객체에서 Enum 값 생성
   * @param {Object} obj - Enum 값 이름-값 객체
   */
  #createFromObject(obj) {
    Object.entries(obj).forEach(([name, value], index) => {
      this.#addValue(name, value, index);
    });
  }

  /**
   * Enum 값 추가
   * @param {string} name - Enum 값 이름
   * @param {*} value - Enum 값
   * @param {number} ordinal - Enum 값 순서
   */
  #addValue(name, value, ordinal) {
    // 이름 유효성 검사 (대문자 영어, 숫자, 언더스코어만 허용)
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      throw new Error(`Invalid enum name: ${name}. Enum names must start with an uppercase letter and contain only uppercase letters, numbers, and underscores.`);
    }
    
    const enumValue = new EnumValue(this.#typeName, name, ordinal, value);
    
    // Enum 객체에 속성으로 추가
    Object.defineProperty(this, name, {
      value: enumValue,
      enumerable: true,
      writable: false,
      configurable: false
    });
    
    // 값 목록 및 맵에 추가
    this.#values.push(enumValue);
    this.#nameToValue.set(name, enumValue);
    
    // 값으로 Enum 검색 지원 (valueOf 보다 효율적인 조회)
    if (value !== undefined && value !== null) {
      const valueKey = typeof value === 'object' ? JSON.stringify(value) : value;
      this.#valueToEnum.set(valueKey, enumValue);
    }
  }

  /**
   * Enum 타입 이름 getter
   * @returns {string} Enum 타입 이름
   */
  get typeName() {
    return this.#typeName;
  }

  /**
   * 모든 Enum 값 반환
   * @returns {EnumValue[]} 모든 Enum 값 배열
   */
  values() {
    return [...this.#values];
  }

  /**
   * 이름으로 Enum 값 조회
   * @param {string} name - Enum 값 이름
   * @returns {EnumValue|undefined} 찾은 Enum 값 또는 undefined
   */
  valueOf(name) {
    return this.#nameToValue.get(name);
  }

  /**
   * 값으로 Enum 값 조회
   * @param {*} value - 찾을 값
   * @returns {EnumValue|undefined} 찾은 Enum 값 또는 undefined
   */
  fromValue(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    
    const valueKey = typeof value === 'object' ? JSON.stringify(value) : value;
    return this.#valueToEnum.get(valueKey);
  }

  /**
   * Enum 타입의 문자열 표현
   * @returns {string} Enum 타입의 문자열 표현
   */
  toString() {
    const valueNames = this.#values.map(v => v.name).join(', ');
    return `Enum<${this.#typeName}>[${valueNames}]`;
  }
}

/**
 * Enum 생성 함수
 * @param {string} typeName - Enum 타입 이름
 * @param {string[]|Object} values - Enum 값 이름 배열 또는 이름-값 객체
 * @returns {Enum} 생성된 Enum 객체
 */
function createEnum(typeName, values) {
  return new Enum(typeName, values);
}

// 모듈 내보내기
export { Enum, EnumValue, createEnum };
export default createEnum; 