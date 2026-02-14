const https = require('https');
const { SecretsManager } = require('./secretsManager');

class AudibleClient {
    constructor(userId, secretsManager) {
        this.userId = userId;
        this.secretsManager = secretsManager;
        this.baseUrl = 'api.audible.com';
        this.accessToken = null;
        this.refreshToken = null;
        this.adpToken = null;
        this.privateKey = null;
        this.deviceInfo = null;
    }

    /**
     * Initialize client with stored authentication data
     */
    async initialize() {
        try {
            // Try to get full auth data first (with adp_token)
            const authData = await this.secretsManager.getSecret(`audible-auth-${this.userId}`, 'prod');
            if (authData) {
                this.adpToken = authData.adpToken;
                this.privateKey = authData.privateKey;
                this.accessToken = authData.accessToken;
                this.refreshToken = authData.refreshToken;
                
                // Check if token is expired and refresh if needed
                if (authData.expiresAt && Date.now() > authData.expiresAt) {
                    await this.refreshAccessToken();
                }
                return;
            }
            
            // Fallback to old token format
            const tokens = await this.secretsManager.getSecret(`audible-tokens-${this.userId}`, 'prod');
            if (tokens) {
                this.accessToken = tokens.accessToken;
                this.refreshToken = tokens.refreshToken;
                
                // Check if token is expired and refresh if needed
                if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
                    await this.refreshAccessToken();
                }
            }
        } catch (error) {
            console.error('Error initializing Audible client:', error);
        }
    }

    /**
     * Store OAuth tokens securely
     */
    async storeTokens(accessToken, refreshToken, expiresIn = 3600) {
        const tokens = {
            accessToken,
            refreshToken,
            expiresAt: Date.now() + (expiresIn * 1000)
        };
        
        await this.secretsManager.putSecret(
            `audible-tokens-${this.userId}`,
            tokens,
            'prod',
            `Audible OAuth tokens for user ${this.userId}`
        );
        
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken() {
        // TODO: Implement OAuth token refresh
        // This requires the Audible OAuth refresh endpoint
        throw new Error('Token refresh not yet implemented');
    }

    /**
     * Authenticate using username/password (device registration)
     * Based on: https://audible.readthedocs.io/en/latest/auth/authentication.html
     * This performs device registration similar to audible.Authenticator.from_login()
     * 
     * @param {string} username - Audible/Amazon email
     * @param {string} password - Audible/Amazon password
     */
    async authenticateWithCredentials(username, password) {
        try {
            // Device registration process (similar to audible Python library):
            // 1. Login to Audible website
            // 2. Register a device to get adp_token and RSA private key
            // 3. Store these for sign request method authentication
            
            // Step 1: Login to Audible website
            const loginResult = await this.performLogin(username, password);
            if (!loginResult.success) {
                return {
                    authenticated: false,
                    message: loginResult.error || 'Failed to login to Audible'
                };
            }
            
            // Step 2: Register device to get authentication tokens
            const deviceRegistration = await this.registerDevice(loginResult.cookies);
            if (!deviceRegistration.success) {
                // If device registration fails, store credentials for later
                // The user can still connect, but API calls will need proper implementation
                await this.secretsManager.putSecret(
                    `audible-credentials-${this.userId}`,
                    {
                        username: username,
                        password: password, // TODO: Encrypt password
                        cookies: loginResult.cookies
                    },
                    'prod',
                    `Audible credentials for user ${this.userId}`
                );
                
                return {
                    authenticated: true,
                    message: 'Login successful. Device registration requires additional implementation. Library sync may not work until device registration is complete.',
                    requiresDeviceRegistration: true
                };
            }
            
            // Step 3: Store authentication data securely
            const authData = {
                username: username,
                adpToken: deviceRegistration.adpToken,
                privateKey: deviceRegistration.privateKey,
                accessToken: deviceRegistration.accessToken,
                refreshToken: deviceRegistration.refreshToken,
                expiresAt: deviceRegistration.expiresAt,
                cookies: loginResult.cookies,
                registeredAt: Date.now()
            };
            
            await this.secretsManager.putSecret(
                `audible-auth-${this.userId}`,
                authData,
                'prod',
                `Audible authentication data for user ${this.userId}`
            );
            
            // Store tokens for immediate use
            this.adpToken = deviceRegistration.adpToken;
            this.privateKey = deviceRegistration.privateKey;
            this.accessToken = deviceRegistration.accessToken;
            this.refreshToken = deviceRegistration.refreshToken;
            
            return {
                authenticated: true,
                message: 'Successfully authenticated and registered device'
            };
        } catch (error) {
            console.error('Error authenticating with credentials:', error);
            return {
                authenticated: false,
                message: `Failed to authenticate: ${error.message}`
            };
        }
    }

    /**
     * Perform login to Audible website
     * Based on: https://github.com/omarroth/audible.cr and mkb79/Audible (Python)
     * Audible uses Amazon's login system
     * @private
     */
    async performLogin(username, password) {
        return new Promise((resolve) => {
            const querystring = require('querystring');
            const http = require('http');
            
            // Step 1: Get the sign-in page to extract CSRF token and other required fields
            const getSignInPage = () => {
                return new Promise((resolvePage) => {
                    const options = {
                        hostname: 'www.audible.com',
                        port: 443,
                        path: '/ap/signin',
                        method: 'GET',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        }
                    };
                    
                    const req = https.request(options, (res) => {
                        let body = '';
                        res.on('data', (chunk) => { body += chunk; });
                        res.on('end', () => {
                            // Extract CSRF token and other form fields from the page
                            const csrfMatch = body.match(/name="csrfToken"\s+value="([^"]+)"/) || 
                                            body.match(/name="_csrf"\s+value="([^"]+)"/) ||
                                            body.match(/csrfToken['"]\s*[:=]\s*['"]([^'"]+)['"]/);
                            const csrfToken = csrfMatch ? csrfMatch[1] : '';
                            
                            const cookies = res.headers['set-cookie'] || [];
                            const cookieString = cookies.map(c => c.split(';')[0]).join('; ');
                            
                            resolvePage({ cookies: cookieString, csrfToken, body });
                        });
                    });
                    
                    req.on('error', (e) => {
                        resolvePage({ error: e.message });
                    });
                    
                    req.end();
                });
            };
            
            // Step 2: Perform the actual login
            getSignInPage().then((pageData) => {
                if (pageData.error) {
                    resolve({
                        success: false,
                        error: `Failed to get sign-in page: ${pageData.error}`
                    });
                    return;
                }
                
                // Try Amazon login endpoint (Audible uses Amazon authentication)
                // Based on the Python library, we should use Amazon's login
                const loginData = querystring.stringify({
                    email: username,
                    password: password,
                    rememberMe: 'true',
                    ...(pageData.csrfToken && { csrfToken: pageData.csrfToken })
                });
                
                const options = {
                    hostname: 'www.amazon.com',
                    port: 443,
                    path: '/ap/signin',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(loginData),
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Cookie': pageData.cookies,
                        'Referer': 'https://www.audible.com/ap/signin',
                        'Origin': 'https://www.amazon.com'
                    }
                };
                
                const req = https.request(options, (res) => {
                    const cookies = res.headers['set-cookie'] || [];
                    const allCookies = [...(pageData.cookies ? pageData.cookies.split('; ') : []), ...cookies.map(c => c.split(';')[0])];
                    const cookieString = allCookies.filter(Boolean).join('; ');
                    
                    let body = '';
                    res.on('data', (chunk) => { body += chunk; });
                    res.on('end', () => {
                        // Check if login was successful
                        // Successful login usually redirects (302/303) or shows account/library page
                        if (res.statusCode === 302 || res.statusCode === 303) {
                            // Follow redirect to get final cookies
                            const location = res.headers.location;
                            if (location && location.includes('audible.com')) {
                                resolve({
                                    success: true,
                                    cookies: cookieString,
                                    redirectLocation: location
                                });
                            } else {
                                // Redirect to Amazon, need to follow to Audible
                                resolve({
                                    success: true,
                                    cookies: cookieString,
                                    redirectLocation: location,
                                    needsAudibleRedirect: true
                                });
                            }
                        } else if (res.statusCode === 200) {
                            // Check for error messages
                            if (body.includes('There was a problem') || 
                                body.includes('incorrect') || 
                                body.includes('Invalid email or password') ||
                                body.includes('Enter your email or mobile phone number')) {
                                resolve({
                                    success: false,
                                    error: 'Invalid username or password'
                                });
                            } else if (body.includes('account') || body.includes('library') || body.includes('audible')) {
                                resolve({
                                    success: true,
                                    cookies: cookieString
                                });
                            } else {
                                resolve({
                                    success: false,
                                    error: `Login response unclear. Status: ${res.statusCode}`
                                });
                            }
                        } else {
                            resolve({
                                success: false,
                                error: `Login failed with status ${res.statusCode}`
                            });
                        }
                    });
                });
                
                req.on('error', (e) => {
                    resolve({
                        success: false,
                        error: e.message
                    });
                });
                
                req.write(loginData);
                req.end();
            });
        });
    }

    /**
     * Register device to get adp_token and private key
     * Based on Audible device registration process
     * @private
     */
    async registerDevice(cookies) {
        return new Promise((resolve) => {
            // Device registration endpoint
            // Note: This is a simplified implementation
            // Full implementation requires parsing Audible's device registration response
            // which may be in HTML/JavaScript format
            
            const options = {
                hostname: 'www.audible.com',
                port: 443,
                path: '/ap/register',
                method: 'POST',
                headers: {
                    'Cookie': cookies,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            };
            
            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    try {
                        // Try to parse as JSON first
                        const response = JSON.parse(body);
                        
                        if (response.adp_token && response.private_key) {
                            resolve({
                                success: true,
                                adpToken: response.adp_token,
                                privateKey: response.private_key,
                                accessToken: response.access_token,
                                refreshToken: response.refresh_token,
                                expiresAt: Date.now() + (3600 * 1000) // 1 hour
                            });
                        } else {
                            // Response format not recognized
                            resolve({
                                success: false,
                                error: 'Device registration response format not recognized. Full implementation requires parsing Audible\'s device registration response format.'
                            });
                        }
                    } catch (e) {
                        // Response is not JSON - likely HTML/JavaScript
                        // The audible Python library handles this by parsing the response
                        // For now, return error indicating this needs proper implementation
                        resolve({
                            success: false,
                            error: 'Device registration requires parsing Audible response format. Consider using the audible Python library approach or implementing proper HTML/JS parsing. For now, credentials are stored and can be used with a proper device registration implementation.'
                        });
                    }
                });
            });
            
            req.on('error', (e) => {
                resolve({
                    success: false,
                    error: e.message
                });
            });
            
            req.end();
        });
    }

    /**
     * Get OAuth authorization URL
     * @param {string} redirectUri - Redirect URI for OAuth callback
     * @param {string} state - State parameter for CSRF protection
     */
    getAuthorizationUrl(redirectUri, state) {
        // TODO: Generate Audible OAuth authorization URL
        // This requires Audible OAuth client ID and configuration
        const clientId = process.env.AUDIBLE_CLIENT_ID || '';
        const scope = 'library_read';
        
        // Placeholder URL - replace with actual Audible OAuth endpoint
        return `https://www.audible.com/ap/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;
    }

    /**
     * Make authenticated API request
     */
    async apiRequest(method, path, data = null) {
        if (!this.accessToken) {
            await this.initialize();
        }

        if (!this.accessToken) {
            throw new Error('Not authenticated. Please connect Audible account.');
        }

        return new Promise((resolve, reject) => {
            const postData = data ? JSON.stringify(data) : null;
            const headers = {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            };

            const reqOptions = {
                hostname: this.baseUrl,
                port: 443,
                path: path,
                method: method,
                headers: headers
            };

            const req = https.request(reqOptions, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        const parsed = body ? JSON.parse(body) : {};
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else if (res.statusCode === 401) {
                            // Token expired, try to refresh
                            this.refreshAccessToken()
                                .then(() => this.apiRequest(method, path, data))
                                .then(resolve)
                                .catch(reject);
                        } else {
                            reject(new Error(`Audible API error: ${res.statusCode} - ${parsed.message || body}`));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${body}`));
                    }
                });
            });

            req.on('error', (e) => {
                reject(e);
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }

    /**
     * Get user's audiobook library
     */
    async getLibrary() {
        // TODO: Implement actual Audible API call
        // The Audible API endpoint for library is typically:
        // GET /1.0/library?num_results=1000&response_groups=product_desc,product_attrs
        
        try {
            const response = await this.apiRequest('GET', '/1.0/library?num_results=1000&response_groups=product_desc,product_attrs');
            
            // Parse Audible API response format
            const books = (response.items || []).map(item => ({
                asin: item.asin,
                title: item.title,
                author: item.authors?.[0]?.name || 'Unknown',
                narrator: item.narrators?.[0]?.name || 'Unknown',
                duration: item.runtime_length_min || 0,
                coverUrl: item.product_images?.[500] || item.product_images?.[300] || '',
                publisher: item.publisher_name || '',
                releaseDate: item.release_date || null
            }));

            return { books };
        } catch (error) {
            console.error('Error fetching Audible library:', error);
            throw error;
        }
    }
}

module.exports = { AudibleClient };
