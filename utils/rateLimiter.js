// Simple in-memory rate limiter
// For production, consider using Redis or DynamoDB for distributed rate limiting

class RateLimiter {
    constructor() {
        this.requests = new Map(); // userId -> { count, resetTime }
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
    }

    /**
     * Check if request should be allowed
     * @param {string} identifier - User ID or IP address
     * @param {number} maxRequests - Maximum requests per window
     * @param {number} windowMs - Time window in milliseconds
     * @returns {boolean} True if allowed, false if rate limited
     */
    isAllowed(identifier, maxRequests = 100, windowMs = 60000) {
        const now = Date.now();
        const record = this.requests.get(identifier);

        if (!record || now > record.resetTime) {
            // New window or expired window
            this.requests.set(identifier, {
                count: 1,
                resetTime: now + windowMs
            });
            return true;
        }

        if (record.count >= maxRequests) {
            return false; // Rate limited
        }

        record.count++;
        return true;
    }

    /**
     * Get remaining requests in current window
     * @param {string} identifier - User ID or IP address
     * @param {number} maxRequests - Maximum requests per window
     * @returns {number} Remaining requests
     */
    getRemaining(identifier, maxRequests = 100) {
        const record = this.requests.get(identifier);
        if (!record || Date.now() > record.resetTime) {
            return maxRequests;
        }
        return Math.max(0, maxRequests - record.count);
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.requests.entries()) {
            if (now > record.resetTime) {
                this.requests.delete(key);
            }
        }
    }

    /**
     * Reset rate limit for a user (useful for testing or admin actions)
     */
    reset(identifier) {
        this.requests.delete(identifier);
    }
}

// Singleton instance
const rateLimiter = new RateLimiter();

module.exports = { rateLimiter };

