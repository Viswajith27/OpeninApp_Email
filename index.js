// Import required modules
const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// OAuth 2.0 scopes for Gmail API
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
// Path to store the OAuth 2.0 token
const TOKEN_PATH = 'token.json';
// Update the path to your credentials JSON file
const CREDENTIALS_PATH = 'C:\\Users\\91900\\Downloads\\client_secret_414255716264-sshjm1iuek85cen2qc5qrt06lnneesfu.apps.googleusercontent.com.json';

// Function to authorize the app using OAuth 2.0
async function authorize() {
  // Load credentials from the specified path
  const credentials = require(CREDENTIALS_PATH);

  const { client_secret, client_id, redirect_uris } = credentials.installed;
  // Create an OAuth2 client with the loaded credentials
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]
  );

  try {
    // Try to read the token from the file
    const token = fs.readFileSync(TOKEN_PATH);
    // Set the credentials for the OAuth2 client
    oAuth2Client.setCredentials(JSON.parse(token));
    // Return the authorized OAuth2 client
    return oAuth2Client;
  } catch (err) {
    // If the token file doesn't exist or is invalid, obtain a new token
    return getNewToken(oAuth2Client);
  }
}

// Function to obtain a new OAuth 2.0 token
async function getNewToken(oAuth2Client) {
  // Generate the URL for user consent
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Authorize this app by visiting this url:', authUrl);

  // Create an interface for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Prompt the user to enter the authorization code
  const code = await new Promise(resolve => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      resolve(code);
    });
  });

  // Obtain tokens using the entered authorization code
  const { tokens } = await oAuth2Client.getToken(code);
  // Set the obtained tokens for the OAuth2 client
  oAuth2Client.setCredentials(tokens);
  // Save the tokens to the token file for future use
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  // Return the authorized OAuth2 client
  return oAuth2Client;
}

// Function to list messages in a Gmail mailbox with a specific label
async function listMessages(auth, label) {
  const gmail = google.gmail({ version: 'v1', auth });
  // Request a list of messages with the specified label
  const response = await gmail.users.messages.list({
    userId: 'me',
    labelIds: [label],
  });

  // Return the list of messages
  return response.data.messages;
}

// Function to send an auto-reply to a specific email
async function sendAutoReply(auth, messageId) {
  const gmail = google.gmail({ version: 'v1', auth });
  // Retrieve the details of a specific message
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
  });

  // Extract the subject of the email
  const subject = response.data.payload.headers.find(header => header.name === 'Subject').value;

  // Check if the email subject does not already include 'Re:'
  if (!subject.includes('Re:')) {
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

    // Log that an auto-reply has been sent
    console.log(`Auto-reply sent to: ${response.data.payload.headers.find(header => header.name === 'From').value}`);
  }
}

// Main function to orchestrate the application
async function main() {
  try {
    // Authorize the app using OAuth 2.0
    const auth = await authorize();

    // Create a label named 'VACATIONsREPLY' if it doesn't exist
    const label = 'VACATIONsREPLY';
    await google.gmail({ version: 'v1', auth }).users.labels.create({
      userId: 'me',
      requestBody: {
        name: label,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    // Continuously check for new emails and send auto-replies
    while (true) {
        // Retrieve a list of messages in the 'INBOX' with the 'VacationReply' label
        const messages = await listMessages(auth, 'INBOX');
  
        // Iterate through each message and send an auto-reply
        for (const message of messages) {
          await sendAutoReply(auth, message.id);
        
          // Introduce a random sleep interval between 45 to 120 seconds
          await sleep(Math.floor(Math.random() * (120000 - 45000)) + 45000); 
        }
      }
    } catch (err) {
      // Handle and log errors
      console.error('Error:', err.message);
    }
  }

  main();
  