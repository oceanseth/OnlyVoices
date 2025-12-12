const AWS = require('aws-sdk');

class SecretsManager {
    constructor(region = 'us-east-1') {
        this.client = new AWS.SecretsManager({ region });
    }

    /**
     * Get a secret value from AWS Secrets Manager
     * @param {string} secretName - Name of the secret (without prefix)
     * @param {string} stage - Deployment stage (prod, dev, etc.)
     * @returns {Promise<object|string>} Secret value (parsed JSON if possible, otherwise string)
     */
    async getSecret(secretName, stage = 'prod') {
        try {
            const fullSecretName = `onlyvoices/${stage}/${secretName}`;
            const result = await this.client.getSecretValue({ SecretId: fullSecretName }).promise();
            
            // Try to parse as JSON, fallback to string
            try {
                return JSON.parse(result.SecretString);
            } catch (e) {
                return result.SecretString;
            }
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                return null;
            }
            throw error;
        }
    }

    /**
     * Create or update a secret in AWS Secrets Manager
     * @param {string} secretName - Name of the secret (without prefix)
     * @param {object|string} secretValue - Value to store
     * @param {string} stage - Deployment stage
     * @param {string} description - Optional description
     * @returns {Promise<string>} Secret ARN
     */
    async putSecret(secretName, secretValue, stage = 'prod', description = null) {
        const fullSecretName = `onlyvoices/${stage}/user/${secretName}`;
        const secretString = typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue);

        try {
            // Try to update existing secret
            const result = await this.client.updateSecret({
                SecretId: fullSecretName,
                SecretString: secretString,
                Description: description
            }).promise();
            return result.ARN;
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                // Create new secret
                const result = await this.client.createSecret({
                    Name: fullSecretName,
                    SecretString: secretString,
                    Description: description || `Secret for ${secretName}`
                }).promise();
                return result.ARN;
            }
            throw error;
        }
    }

    /**
     * Delete a secret
     * @param {string} secretName - Name of the secret
     * @param {string} stage - Deployment stage
     */
    async deleteSecret(secretName, stage = 'prod') {
        const fullSecretName = `onlyvoices/${stage}/user/${secretName}`;
        try {
            await this.client.deleteSecret({
                SecretId: fullSecretName,
                ForceDeleteWithoutRecovery: true
            }).promise();
        } catch (error) {
            if (error.code !== 'ResourceNotFoundException') {
                throw error;
            }
        }
    }
}

module.exports = { SecretsManager };

