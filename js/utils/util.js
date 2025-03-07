/**
 * 현재 페이지가 로컬 호스트(개발 환경)인지 확인
 * @returns {boolean} 로컬 호스트 여부
 */
export function isLocalhost() {
    // Get the hostname from the current URL.
    const hostname = window.location.hostname;
  
    // If hostname is empty (e.g. when using file:// protocol), treat as local.
    if (!hostname) return true;
  
    // 1. Standard hostname for localhost.
    if (hostname === 'localhost') return true;
  
    // 2. IPv6 localhost addresses.
    // Some browsers might return either "[::1]" or "::1".
    if (hostname === '[::1]' || hostname === '::1') return true;
  
    // 3. IPv4 loopback addresses.
    // According to IPv4 standards, any address in the 127.0.0.0/8 block is loopback.
    // This regular expression strictly matches numbers between 0 and 255.
    const ipv4LoopbackRegex = /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/;
    if (ipv4LoopbackRegex.test(hostname)) return true;
  
    // 4. 'testapp' subdomain - for specific testing environments.
    if (hostname.includes('testapp')) return true;
  
    return false;
}

class SimpleMapBuilder {
    constructor() {
        this.map = new Map();
    }

    add(key, value) {
        if (value instanceof SimpleMapBuilder) {
            value = value.build();
        }
        this.map.set(key, value);
        return this;
    }

    build() {
        return this.map;
    }
}

export const map = () => new SimpleMapBuilder();
