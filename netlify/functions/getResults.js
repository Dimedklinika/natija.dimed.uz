const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.MY_AWS_REGION || 'us-east-1';

// Normalize phone number to always include + prefix
function normalizePhone(phone) {
    if (!phone) return '';
    const cleaned = String(phone).replace(/\D/g, '');
    return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

const client = new DynamoDBClient({
    region: REGION,
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
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS, POST'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Get user phone from Authorization header (set by client)
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Authorization required' })
            };
        }

        let phone = authHeader.substring(7); // Remove 'Bearer ' prefix
        phone = normalizePhone(phone);

        if (!phone) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Patient phone not provided' })
            };
        }

        // Scan the table for results with matching phone (since GSI structure is unclear)
        const command = new ScanCommand({
            TableName: 'AnalysisResult',
            FilterExpression: 'Phone = :phone',
            ExpressionAttributeValues: {
                ':phone': phone
            }
        });

        const response = await docClient.send(command);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response.Items || [])
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



