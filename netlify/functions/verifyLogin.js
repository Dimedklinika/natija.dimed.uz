const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
    region: process.env.MY_AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY
    }
});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { code } = JSON.parse(event.body || '{}');

        if (!code) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Code is required' })
            };
        }

        // Scan UserVerification table to find the code
        const scanCommand = new ScanCommand({
            TableName: 'UserVerification',
            FilterExpression: '#code = :code AND codeTTL > :now',
            ExpressionAttributeNames: {
                '#code': 'code'
            },
            ExpressionAttributeValues: {
                ':code': code,
                ':now': Math.floor(Date.now() / 1000)
            }
        });

        const scanResult = await docClient.send(scanCommand);

        if (!scanResult.Items || scanResult.Items.length === 0) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid or expired code' })
            };
        }

        const userRecord = scanResult.Items[0];
        
        if (!userRecord || !userRecord.telegramUserId) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Invalid user record found' })
            };
        }

        const telegramUserId = userRecord.telegramUserId;

        // Remove code attributes from user record
        const updateCommand = new UpdateCommand({
            TableName: 'UserVerification',
            Key: {
                telegramUserId: telegramUserId
            },
            UpdateExpression: 'REMOVE #code, codeCreatedAt, codeTTL',
            ExpressionAttributeNames: {
                '#code': 'code'
            },
            ReturnValues: 'ALL_NEW'
        });

        await docClient.send(updateCommand);

        // Return user info (without code attributes) with safe property access
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                user: {
                    telegramUserId: userRecord.telegramUserId || '',
                    phone: userRecord.phone || '',
                    name: userRecord.name || ''
                }
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};


