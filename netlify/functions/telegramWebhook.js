const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

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
        const update = JSON.parse(event.body || '{}');

        // Telegram sends updates in this format
        if (!update.message || !update.message.from) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ ok: true, message: 'No message from user' })
            };
        }

        const from = update.message.from;
        const telegramUserId = String(from.id);
        const phone = from.phone_number || '';
        const firstName = from.first_name || '';
        const lastName = from.last_name || '';
        const name = `${firstName} ${lastName}`.trim() || firstName || 'Unknown';

        // Generate 6-digit code (100000-999999)
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const now = Math.floor(Date.now() / 1000);
        const codeTTL = now + 120; // 2 minutes from now

        // Update or create user record in UserVerification table
        const updateCommand = new UpdateCommand({
            TableName: 'UserVerification',
            Key: {
                telegramUserId: telegramUserId
            },
            UpdateExpression: 'SET #phone = :phone, #name = :name, #code = :code, codeCreatedAt = :codeCreatedAt, codeTTL = :codeTTL',
            ExpressionAttributeNames: {
                '#phone': 'phone',
                '#name': 'name',
                '#code': 'code'
            },
            ExpressionAttributeValues: {
                ':phone': phone,
                ':name': name,
                ':code': code,
                ':codeCreatedAt': now,
                ':codeTTL': codeTTL
            }
        });

        await docClient.send(updateCommand);

        // Send code back to user via Telegram Bot API
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN not configured');
        }

        const chatId = update.message.chat.id;
        const message = `Your verification code is: ${code}\n\nThis code will expire in 2 minutes.`;

        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message
            })
        });

        if (!telegramResponse.ok) {
            const errorData = await telegramResponse.text();
            console.error('Telegram API error:', errorData);
            throw new Error('Failed to send message via Telegram');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ ok: true, message: 'Code sent successfully' })
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



