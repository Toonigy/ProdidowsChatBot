// auth.js
// This file handles Firebase Authentication for login and signup.

// Import necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// getFirestore is imported but not used in this file; it's here for consistency if you expand upon auth logic later.
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment (or defaults for local testing)
// These ensure the app can run correctly both within the Canvas and locally.
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

// Initialize Firebase app and services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Firestore instance, ready for future use if needed for user profiles etc.

// Get references to HTML elements from index.html
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const signupEmailInput = document.getElementById('signupEmail');
const signupPasswordInput = document.getElementById('signupPassword');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');
const loginSection = document.getElementById('loginSection');
const signupSection = document.getElementById('signupSection');
const showSignupLink = document.getElementById('showSignup');
const showLoginLink = document.getElementById('showLogin');

/**
 * Displays an error message in the specified HTML element.
 * @param {HTMLElement} element - The HTML element to display the message.
 * @param {string} message - The error message to show.
 */
function showErrorMessage(element, message) {
    element.textContent = message;
    element.classList.remove('hidden'); // Make the error message visible
}

/**
 * Hides the error message from the specified HTML element.
 * @param {HTMLElement} element - The HTML element from which to hide the message.
 */
function hideErrorMessage(element) {
    element.classList.add('hidden'); // Hide the error message
    element.textContent = ''; // Clear the text content
}

// --- Authentication State Listener ---
// This listener fires whenever the user's sign-in state changes.
// It's crucial for redirecting users after login/signup or handling anonymous sign-in.
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is successfully signed in (either new signup, existing login, or anonymous)
        console.log("User is signed in:", user.uid);
        // Redirect to the chatbot page upon successful authentication
        window.location.href = 'chatbot.html';
    } else {
        // User is signed out or not yet authenticated (e.g., initial page load without a session)
        console.log("No user signed in. Attempting anonymous or custom token sign-in if applicable.");
        // Attempt to sign in with a custom token first if provided by the environment
        if (initialAuthToken) {
            try {
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("Signed in with custom token.");
            } catch (error) {
                console.error("Error signing in with custom token:", error);
                // Fallback to anonymous if custom token fails (e.g., expired or invalid)
                try {
                    await signInAnonymously(auth);
                    console.log("Signed in anonymously (fallback).");
                } catch (anonError) {
                    console.error("Error signing in anonymously:", anonError);
                }
            }
        } else {
            // If no custom token, sign in anonymously by default for immediate interaction
            try {
                await signInAnonymously(auth);
                console.log("Signed in anonymously.");
            } catch (error) {
                console.error("Error signing in anonymously:", error);
            }
        }
    }
});

// --- Event Listeners for Forms and UI Toggles ---

// Handle Login Form Submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent the default browser form submission
    hideErrorMessage(loginError); // Clear any previous error messages

    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    try {
        // Attempt to sign in the user with the provided email and password
        await signInWithEmailAndPassword(auth, email, password);
        // If successful, onAuthStateChanged listener will handle the redirection.
        console.log("Login successful! Redirecting...");
    } catch (error) {
        console.error("Login Error:", error.code, error.message);
        let errorMessage = "An unexpected error occurred. Please try again.";
        // Provide more specific error messages based on Firebase error codes
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = "The email address is not valid.";
                break;
            case 'auth/user-disabled':
                errorMessage = "This account has been disabled.";
                break;
            case 'auth/user-not-found':
                errorMessage = "No user found with this email. Please check your email or sign up.";
                break;
            case 'auth/wrong-password':
            case 'auth/invalid-credential': // Modern Firebase uses this for wrong password/email combination
                errorMessage = "Incorrect email or password. Please try again.";
                break;
            case 'auth/missing-password':
                errorMessage = "Please enter your password.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Too many failed login attempts. Please try again later.";
                break;
            default:
                errorMessage = "Login failed: " + error.message;
        }
        showErrorMessage(loginError, errorMessage);
    }
});

// Handle Signup Form Submission
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission
    hideErrorMessage(signupError); // Clear any previous error messages

    const email = signupEmailInput.value;
    const password = signupPasswordInput.value;

    try {
        // Attempt to create a new user with the provided email and password
        await createUserWithEmailAndPassword(auth, email, password);
        // If successful, onAuthStateChanged listener will handle the redirection.
        console.log("Signup successful! Redirecting...");
    } catch (error) {
        console.error("Signup Error:", error.code, error.message);
        let errorMessage = "An unexpected error occurred during signup.";
        // Provide more specific error messages based on Firebase error codes
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = "This email address is already in use. Try logging in or use a different email.";
                break;
            case 'auth/invalid-email':
                errorMessage = "The email address is not valid.";
                break;
            case 'auth/operation-not-allowed':
                errorMessage = "Email/password accounts are not enabled. Please contact support.";
                break;
            case 'auth/weak-password':
                errorMessage = "The password is too weak. Please choose a password with at least 6 characters.";
                break;
            default:
                errorMessage = "Signup failed: " + error.message;
        }
        showErrorMessage(signupError, errorMessage);
    }
});

// Toggle between Login and Signup sections
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginSection.classList.add('hidden');
    signupSection.classList.remove('hidden');
    hideErrorMessage(loginError); // Clear error when switching forms
    hideErrorMessage(signupError); // Clear error when switching forms
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    hideErrorMessage(loginError); // Clear error when switching forms
    hideErrorMessage(signupError); // Clear error when switching forms
});

