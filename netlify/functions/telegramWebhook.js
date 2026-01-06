const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

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
        const firstName = from.first_name || '';
        const lastName = from.last_name || '';
        const name = `${firstName} ${lastName}`.trim() || firstName || 'Unknown';

        const now = Math.floor(Date.now() / 1000);

        // Check if user shared contact
        let phone = '';
        if (update.message.contact && update.message.contact.phone_number) {
            phone = update.message.contact.phone_number;
        }

        // First, check if user has an existing record
        const queryCommand = new QueryCommand({
            TableName: 'UserVerification',
            KeyConditionExpression: 'telegramUserId = :telegramUserId',
            ExpressionAttributeValues: {
                ':telegramUserId': telegramUserId
            }
        });

        const queryResult = await docClient.send(queryCommand);
        let existingRecord = null;

        if (queryResult.Items && queryResult.Items.length > 0) {
            existingRecord = queryResult.Items[0];
        }

        // If user shared contact, update their phone number
        if (phone && (!existingRecord || !existingRecord.phone)) {
            const updatePhoneCommand = new UpdateCommand({
                TableName: 'UserVerification',
                Key: {
                    telegramUserId: telegramUserId
                },
                UpdateExpression: 'SET #phone = :phone, #name = :name',
                ExpressionAttributeNames: {
                    '#phone': 'phone',
                    '#name': 'name'
                },
                ExpressionAttributeValues: {
                    ':phone': phone,
                    ':name': name
                }
            });
            await docClient.send(updatePhoneCommand);
            existingRecord = { ...existingRecord, phone, name };
        }

        // Check if user has phone number stored
        if (!existingRecord || !existingRecord.phone) {
            // Ask for phone number
            const chatId = update.message.chat.id;
            const message = `Please share your phone number to receive verification codes.\n\nClick the button below to share your contact:`;

            const telegramResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    reply_markup: {
                        keyboard: [
                            [{ text: '📱 Share Phone Number', request_contact: true }]
                        ],
                        one_time_keyboard: true,
                        resize_keyboard: true
                    }
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
                body: JSON.stringify({ ok: true, message: 'Phone number requested' })
            };
        }

        // User has phone number, proceed with code generation
        let existingCode = existingRecord.code;
        let codeTTL = existingRecord.codeTTL;

        // Check if existing code is still valid (TTL > current time)
        let code;
        if (existingCode && codeTTL && codeTTL > now) {
            // Use existing valid code
            code = existingCode;
        } else {
            // Generate new code
            code = String(Math.floor(100000 + Math.random() * 900000));
            codeTTL = now + 120; // 2 minutes from now
        }

        // Update user record with code
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
                ':phone': existingRecord.phone,
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
        const isNewCode = !existingCode || !codeTTL || codeTTL <= now;
        const message = isNewCode
            ? `Code: ${code}`
            : `Code: ${code}\n\nBu kod amal qilish muddati tugamagan.`;

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



