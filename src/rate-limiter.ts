interface RateLimitChecker {
    (origin: string): string | null;
}

export default function createRateLimitChecker(limit: string): RateLimitChecker {
    // Configure rate limit.
    const rateLimitConfig = /^(\d+) (\d+)(?:\s*$|\s+(.+)$)/.exec(limit);
    if (!rateLimitConfig) {
        // No rate limit by default.
        return (origin: string) => null;
    }

    const maxRequestsPerPeriod = parseInt(rateLimitConfig[1]);
    const periodInMinutes = parseInt(rateLimitConfig[2]);
    let unlimitedPattern: RegExp | undefined;
  
    const unlimitedPatternString = rateLimitConfig[3];
    if (unlimitedPatternString) {
        const unlimitedPatternParts = unlimitedPatternString.trim().split(/\s+/).map(unlimitedHost => {
        if (unlimitedHost.startsWith('/') && unlimitedHost.endsWith('/')) {
            const regexPattern = unlimitedHost.slice(1, -1);
            // Throws if the pattern is invalid.
            return new RegExp(regexPattern, 'i');
        } else {
            // Just escape RegExp characters even though they cannot appear in a host name.
            // The only actual important escape is the dot.
            return unlimitedHost.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
        }
      });
  
        const joinedPattern = unlimitedPatternParts.join('|');
        unlimitedPattern = new RegExp(`^(?:${joinedPattern})$`, 'i');
    }
  
    const accessedHosts: Record<string, number> = {};
  
    setInterval(() => {
        Object.keys(accessedHosts).forEach(host => {
            delete accessedHosts[host];
        });
    }, periodInMinutes * 60000);
  
    const rateLimitMessage = `The number of requests is limited to ${maxRequestsPerPeriod} per ${periodInMinutes === 1 ? 'minute' : periodInMinutes + ' minutes'}. Please self-host CORS Anywhere if you need more quota. See https://github.com/Rob--W/cors-anywhere#demo-server`;
  
    return function checkRateLimit(origin: string) {
        const host = origin.replace(/^[\w\-]+:\/\//i, '');
        if (unlimitedPattern && unlimitedPattern.test(host)) {
            return null;
        }
        const count = accessedHosts[host] || 0;
        accessedHosts[host] = count + 1;
        if (count + 1 > maxRequestsPerPeriod) {
            return rateLimitMessage;
        }
        return null;
    };
}
  