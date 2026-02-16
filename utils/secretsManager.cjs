const { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand, CreateSecretCommand, DeleteSecretCommand } = require('@aws-sdk/client-secrets-manager');

class SecretsManager {
    constructor(region = 'us-east-1') {
        this.client = new SecretsManagerClient({ region });
    }

    async getSecret(secretName, stage = 'prod') {
        try {
            const fullSecretName = `onlyvoices/${stage}/${secretName}`;
            const result = await this.client.send(new GetSecretValueCommand({ SecretId: fullSecretName }));

            try {
                return JSON.parse(result.SecretString);
            } catch (e) {
                return result.SecretString;
            }
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                return null;
            }
            throw error;
        }
    }

    async putSecret(secretName, secretValue, stage = 'prod', description = null) {
        const fullSecretName = `onlyvoices/${stage}/user/${secretName}`;
        const secretString = typeof secretValue === 'string' ? secretValue : JSON.stringify(secretValue);

        try {
            const result = await this.client.send(new UpdateSecretCommand({
                SecretId: fullSecretName,
                SecretString: secretString,
                Description: description,
            }));
            return result.ARN;
        } catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                const result = await this.client.send(new CreateSecretCommand({
                    Name: fullSecretName,
                    SecretString: secretString,
                    Description: description || `Secret for ${secretName}`,
                }));
                return result.ARN;
            }
            throw error;
        }
    }

    async deleteSecret(secretName, stage = 'prod') {
        const fullSecretName = `onlyvoices/${stage}/user/${secretName}`;
        try {
            await this.client.send(new DeleteSecretCommand({
                SecretId: fullSecretName,
                ForceDeleteWithoutRecovery: true,
            }));
        } catch (error) {
            if (error.name !== 'ResourceNotFoundException') {
                throw error;
            }
        }
    }
}

module.exports = { SecretsManager };
