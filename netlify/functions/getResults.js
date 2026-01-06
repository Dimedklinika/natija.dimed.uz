const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1'
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
        const { patientPhone, date } = JSON.parse(event.body || '{}');

        if (!patientPhone) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'PatientPhone is required' })
            };
        }

        let command;

        if (date) {
            // Query specific date
            command = new QueryCommand({
                TableName: 'AnalysisResult',
                KeyConditionExpression: 'PatientPhone = :phone AND #date = :date',
                ExpressionAttributeNames: {
                    '#date': 'date'
                },
                ExpressionAttributeValues: {
                    ':phone': patientPhone,
                    ':date': date
                }
            });
        } else {
            // Query all dates for this patient
            command = new QueryCommand({
                TableName: 'AnalysisResult',
                KeyConditionExpression: 'PatientPhone = :phone',
                ExpressionAttributeValues: {
                    ':phone': patientPhone
                }
            });
        }

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



