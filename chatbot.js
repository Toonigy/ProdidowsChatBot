// chatbot.js
// This file handles the main chatbot logic: authentication, sending/receiving messages,
// Firebase Firestore integration for message storage, and Gemini API for bot responses.

// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    orderBy, // Will be used if a specific order is needed, but note the caution in instructions
    onSnapshot, // For real-time updates
    addDoc,     // To add new messages
    serverTimestamp // To get server-side timestamp for messages
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment (or defaults for local testing)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyDHTlgcqvk6KFpZB4f86L9RzKMzC7GuxiE",
    authDomain: "prodidowschatbot.firebaseapp.com",
    projectId: "prodidowschatbot",
    storageBucket: "prodidowschatbot.firebasestorage.app",
    messagingSenderId: "1074438596420",
    appId: "1:1074438596420:web:92fdaad74c112855c61911",
    measurementId: "G-77RTGSNN85"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Get references to HTML elements
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessageButton');
const logoutButton = document.getElementById('logoutButton');
const loadingIndicator = document.getElementById('loadingIndicator');

let currentUserId = null; // To store the authenticated user's ID
let isAuthReady = false; // Flag to ensure Firestore operations happen after auth

// --- Firebase Authentication State Listener ---
// This ensures that the user is authenticated before interacting with Firestore.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in. Store their UID.
        currentUserId = user.uid;
        isAuthReady = true;
        console.log("User signed in with UID:", currentUserId);
        // Load existing messages for this user
        loadMessages();
    } else {
        // User is signed out. Redirect to login or try anonymous sign-in.
        console.log("No user signed in on chatbot.html. Attempting sign-in.");
        isAuthReady = false;
        currentUserId = null;
        if (initialAuthToken) {
            try {
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Signed in with custom token.");
            } catch (error) {
                console.error("Error signing in with custom token:", error);
                // If custom token fails, try anonymous
                try {
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously (fallback).");
                } catch (anonError) {
                    console.error("Error signing in anonymously:", anonError);
                    window.location.href = 'index.html'; // Redirect to login if anonymous fails
                }
            }
        } else {
            // If no custom token, sign in anonymously by default
            try {
                await signInAnonymously(auth);
                console.log("Signed in anonymously.");
            } catch (error) {
                console.error("Error signing in anonymously:", error);
                window.location.href = 'index.html'; // Redirect to login if anonymous fails
            }
        }
    }
});

// --- Chat Message Display and Storage Functions ---

/**
 * Appends a message bubble to the chat interface.
 * @param {string} text - The text content of the message.
 * @param {'user'|'bot'} sender - The sender of the message ('user' or 'bot').
 */
function appendMessage(text, sender) {
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble', sender);
    messageBubble.textContent = text;
    messagesArea.appendChild(messageBubble);
    // Scroll to the bottom to show the latest message
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

/**
 * Saves a message to Firebase Firestore.
 * @param {string} text - The message text.
 * @param {'user'|'bot'} sender - The sender ('user' or 'bot').
 */
async function saveMessage(text, sender) {
    if (!currentUserId || !isAuthReady) {
        console.warn("User not authenticated or auth not ready. Cannot save message.");
        return;
    }
    try {
        // Path: /artifacts/{appId}/users/{userId}/messages
        const messagesCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/messages`);
        await addDoc(messagesCollectionRef, {
            text: text,
            sender: sender,
            timestamp: serverTimestamp() // Use server timestamp for consistent ordering
        });
        console.log("Message saved to Firestore.");
    } catch (error) {
        console.error("Error saving message to Firestore:", error);
    }
}

/**
 * Loads messages from Firebase Firestore and displays them in real-time.
 */
function loadMessages() {
    if (!currentUserId || !isAuthReady) {
        console.warn("User not authenticated or auth not ready. Cannot load messages.");
        return;
    }

    // Path: /artifacts/{appId}/users/{userId}/messages
    const messagesCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/messages`);
    // Create a query to order messages by timestamp
    const q = query(messagesCollectionRef, orderBy('timestamp'));

    // Set up a real-time listener for messages
    onSnapshot(q, (snapshot) => {
        // Clear existing messages to re-render all (simpler for this example)
        // In a production app, you might diff changes for smoother updates
        messagesArea.innerHTML = ''; // Clear only the dynamically added messages

        // Re-add the initial bot message
        const initialBotMessage = document.createElement('div');
        initialBotMessage.classList.add('message-bubble', 'bot');
        initialBotMessage.textContent = "Hello! I'm your friendly chatbot. How can I assist you today?";
        messagesArea.appendChild(initialBotMessage);

        snapshot.forEach((doc) => {
            const message = doc.data();
            appendMessage(message.text, message.sender);
        });
        // Append the loading indicator if it's currently visible
        if (!loadingIndicator.classList.contains('hidden')) {
            messagesArea.appendChild(loadingIndicator);
            messagesArea.scrollTop = messagesArea.scrollHeight; // Scroll to bottom after adding loading dots
        }
        messagesArea.scrollTop = messagesArea.scrollHeight; // Ensure scroll to bottom after loading all messages
    }, (error) => {
        console.error("Error fetching messages:", error);
    });
}

// --- Gemini API Integration for Chatbot Responses ---

let chatHistory = []; // To maintain conversation context for the Gemini API

/**
 * Shows the loading indicator.
 */
function showLoadingIndicator() {
    loadingIndicator.classList.remove('hidden');
    messagesArea.scrollTop = messagesArea.scrollHeight; // Scroll to bottom to show dots
}

/**
 * Hides the loading indicator.
 */
function hideLoadingIndicator() {
    loadingIndicator.classList.add('hidden');
}

/**
 * Calls the Gemini API to get a chatbot response.
 * Implements exponential backoff for retries.
 * @param {string} prompt - The user's message prompt.
 * @param {number} retries - Number of retry attempts.
 * @param {number} delay - Initial delay for exponential backoff.
 * @returns {Promise<string>} The chatbot's response text.
 */
async function getChatbotResponse(prompt, retries = 3, delay = 1000) {
    showLoadingIndicator();
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });

    const payload = { contents: chatHistory };
    const apiKey = ""; // Canvas will automatically provide this at runtime
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // If response is not ok, throw an error to trigger retry
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                chatHistory.push({ role: "model", parts: [{ text: text }] }); // Add bot response to history
                hideLoadingIndicator();
                return text;
            } else {
                console.warn("Gemini API response structure unexpected:", result);
                throw new Error("Unexpected Gemini API response structure.");
            }
        } catch (error) {
            console.error(`Attempt ${i + 1} failed: ${error.message}`);
            if (i < retries - 1) {
                // Wait for exponential backoff delay before retrying
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            } else {
                hideLoadingIndicator();
                console.error("All retries failed. Could not get chatbot response.");
                // Clear chat history on final failure to prevent stale context
                chatHistory = [];
                return "I'm sorry, I'm having trouble connecting right now. Please try again later.";
            }
        }
    }
    hideLoadingIndicator();
    return "I'm sorry, I could not get a response."; // Should not be reached if retries are handled
}

// --- Event Listeners ---

// Send message when button is clicked or Enter is pressed
sendMessageButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

/**
 * Handles sending a message from the user, saving it, and getting a bot response.
 */
async function sendMessage() {
    const userMessage = messageInput.value.trim();
    if (userMessage === '') {
        return; // Don't send empty messages
    }

    // Clear input field immediately
    messageInput.value = '';

    // Append user message to the UI and save to Firestore
    appendMessage(userMessage, 'user');
    await saveMessage(userMessage, 'user');

    // Get chatbot response
    const botResponse = await getChatbotResponse(userMessage);

    // Append bot response to the UI and save to Firestore
    appendMessage(botResponse, 'bot');
    await saveMessage(botResponse, 'bot');
}

// Handle Logout Button Click
logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth); // Sign out the current user
        console.log("User signed out.");
        window.location.href = 'index.html'; // Redirect to login page
    } catch (error) {
        console.error("Error signing out:", error);
        // Optionally, display a message to the user about the sign-out error
        appendMessage("Error logging out. Please try again.", "bot");
    }
});

