const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.MY_AWS_REGION || 'us-east-1';
const TABLE_NAME = process.env.AWS_DYNAMODB_TABLE || 'AnalysisResult';

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
        // Get DocumentUID from Authorization header or URL parameter
        const pathParts = event.path.split('/').filter(Boolean);
        const documentUID = pathParts[pathParts.length - 1];;

        // Try from body if not in header or query params
        if (!documentUID && event.body) {
            try {
                const body = JSON.parse(event.body);
                documentUID = body.documentUID;
            } catch (e) {
                // Body is not JSON, ignore
            }
        }

        if (!documentUID) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Document UID not provided' })
            };
        }

        // Get the specific result by DocumentUID (partition key)
        // Since DocumentUID is unique, we'll query and return the first result
        const command = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'DocumentUID = :documentUID',
            ExpressionAttributeValues: {
                ':documentUID': documentUID
            },
            Limit: 1 // Since DocumentUID should be unique
        });

        const response = await docClient.send(command);

        if (!response.Items || response.Items.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Result not found' })
            };
        }

        // Return the first (and should be only) result
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response.Items[0])
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
