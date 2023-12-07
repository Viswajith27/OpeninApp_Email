const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const util = require('util');
const sleep = util.promisify(setTimeout);

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'C:\\Users\\91900\\Downloads\\client_secret_414255716264-sshjm1iuek85cen2qc5qrt06lnneesfu.apps.googleusercontent.com (1).json';
const EMAIL_ADDRESS = 'vichurajan2607@gmail.com';

// Load client secrets from a file, and setup the Gmail API
const authorize = async () => {
  try {
    const content = fs.readFileSync(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token
    try {
      const token = fs.readFileSync(TOKEN_PATH);
      oAuth2Client.setCredentials(JSON.parse(token));
    } catch (err) {
      // If the token file doesn't exist or is invalid, obtain a new token
      await getNewToken(oAuth2Client);
    }

    return oAuth2Client;
  } catch (error) {
    console.error('Error loading client secret file:', error.message);
    throw error;
  }
};

const getNewToken = async (oAuth2Client) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this url:', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise((resolve) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      resolve(code);
    });
  });

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    return oAuth2Client;
  } catch (error) {
    console.error('Error while trying to retrieve access token:', error.message);
    throw error;
  }
};

// Function to send an auto-reply to a specific email and add a label to the message
const sendAutoReplyAndAddLabel = async (gmail, messageId, labelName) => {
  try {
    // Retrieve the details of a specific message
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    // Extract the subject of the email
    const subject = response.data.payload.headers.find(header => header.name === 'Subject').value;

    // Create an auto-reply message body
    const body = 'Thank you for your email. I am currently out of the office and will get back to you as soon as possible.';

    // Send an auto-reply email
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: Buffer.from(`To: ${response.data.payload.headers.find(header => header.name === 'From').value}\r\n` +
          `Subject: Re: ${subject}\r\n\r\n${body}`).toString('base64'),
      },
    });

    // Add a label to the message
    const labelId = await getOrCreateLabelId(gmail, labelName);
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });

    console.log(`Auto-reply sent and labeled to: ${response.data.payload.headers.find(header => header.name === 'From').value}`);
  } catch (error) {
    console.error('Error in sendAutoReplyAndAddLabel:', error.message);
    throw error;
  }
};

// Function to get or create a label and return its ID
const getOrCreateLabelId = async (gmail, labelName) => {
  try {
    const labels = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labels.data.labels.find(label => label.name === labelName);

    if (existingLabel) {
      return existingLabel.id;
    } else {
      const newLabel = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      return newLabel.data.id;
    }
  } catch (error) {
    console.error('Error in getOrCreateLabelId:', error.message);
    throw error;
  }
};

const main = async () => {
  try {
    const auth = await authorize();
    await checkAndReply(auth);
  } catch (error) {
    console.error('Error in main:', error.message);
  }
};
const checkAndReply = async (auth) => {
    try {
      const gmail = google.gmail({ version: 'v1', auth });
  
      // Step 1: List messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['INBOX'],
      });
  
      const messages = response.data.messages || [];
  
      for (const message of messages) {
        const messageDetails = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
        });
  
        const threadId = messageDetails.data.threadId;
  
        // Check if thread has been processed
        if (!processedThreads.has(threadId)) {
          // Mark the thread as processed
          processedThreads.add(threadId);
  
          // Check if thread has prior replies
          const threadDetails = await gmail.users.threads.get({
            userId: 'me',
            id: threadId,
          });
  
          const hasReplies = threadDetails.data.messages.some(
            (msg) => msg.from && msg.from.emailAddress && msg.from.emailAddress.address === EMAIL_ADDRESS
          );
  
          if (!hasReplies) {
            // Send a reply and add a label to the message
            await sendAutoReplyAndAddLabel(gmail, message.id, 'VACATREPLY');
  
            console.log(`Replied to email with subject: ${messageDetails.data.payload.subject}`);
          } else {
            console.log(`Already replied to email with subject: ${messageDetails.data.payload.subject}`);
          }
        } else {
          console.log(`Already processed thread with ID: ${threadId}`);
        }
  
        // Introduce a random sleep interval between 45 to 120 seconds
        await sleep(Math.floor(Math.random() * (120000 - 45000)) + 45000);
      }
    } catch (error) {
      console.error('Error in checkAndReply:', error.message);
      throw error;
    }
  };
  
// Keep track of processed email thread IDs
const processedThreads = new Set();

// Call the function to check and reply
main();
