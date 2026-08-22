import React, { useState, useEffect, useRef } from 'react';
import translations from './i18n';
import { hashPassword, encryptPayload, decryptPayload, generateRandomBytes, bytesToHex } from './cryptoUtils';
import TopNavbar from './components/TopNavbar';
import Dashboard from './components/Dashboard';
import DocumentReader from './components/DocumentReader';
import VoiceSuite from './components/VoiceSuite';
import InclusionMap from './components/InclusionMap';
import Simulators from './components/Simulators';
import GullyGame from './components/GullyGame';
import ChatBotWidget from './components/ChatBotWidget';
import DynamicBackground from './components/DynamicBackground';

function loadFirebaseSDK() {
  return new Promise((resolve, reject) => {
    if (window.firebase && window.firebase.auth) {
      resolve(window.firebase);
      return;
    }
    
    let scriptApp = document.getElementById("firebase-app-script");
    if (!scriptApp) {
      scriptApp = document.createElement("script");
      scriptApp.id = "firebase-app-script";
      scriptApp.src = "https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js";
      scriptApp.async = true;
      document.head.appendChild(scriptApp);
    }
    
    const checkFirebaseLoaded = setInterval(() => {
      if (window.firebase) {
        clearInterval(checkFirebaseLoaded);
        
        let scriptAuth = document.getElementById("firebase-auth-script");
        if (!scriptAuth) {
          scriptAuth = document.createElement("script");
          scriptAuth.id = "firebase-auth-script";
          scriptAuth.src = "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js";
          scriptAuth.async = true;
          document.head.appendChild(scriptAuth);
        }
        
        const checkAuthLoaded = setInterval(() => {
          if (window.firebase && window.firebase.auth) {
            clearInterval(checkAuthLoaded);
            resolve(window.firebase);
          }
        }, 100);
      }
    }, 100);
  });
}

export default function App({ isClerkActive = false, clerkUser = null, clerkSignOut = null, clerkUserButton = null }) {
  // Global Application State loading helper
  const savedProfile = (() => {
    try {
      const saved = localStorage.getItem("aura_react_profile");
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  })();

  const hasVault = !!localStorage.getItem("aura_secure_vault");
  const [isAuthenticated, setIsAuthenticated] = useState(savedProfile.isAuthenticated === true);
  const [userName, setUserName] = useState(savedProfile.userName || "Guest");
  const [userEmail, setUserEmail] = useState(savedProfile.userEmail || "");
  const [lang, setLang] = useState(savedProfile.lang || "en");
  const [fontScale, setFontScale] = useState(savedProfile.fontScale || 100);
  const [dyslexiaMode, setDyslexiaMode] = useState(savedProfile.dyslexiaMode === true);
  const [voiceNavEnabled, setVoiceNavEnabled] = useState(savedProfile.voiceNavEnabled === true);
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(savedProfile.voiceGuidanceEnabled === true);
  const [colorFilter, setColorFilter] = useState(savedProfile.colorFilter || "none");
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(savedProfile.autoScrollSpeed || "none");
  const [activePanel, setActivePanel] = useState("panel-dashboard");
  
  // Modal visibility
  const [showAuthModal, setShowAuthModal] = useState(savedProfile.isAuthenticated !== true);
  const [authMode, setAuthMode] = useState(hasVault ? "signin" : "register");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [showGoogleSelector, setShowGoogleSelector] = useState(false);
  const [googleAccounts, setGoogleAccounts] = useState([]);
  const [googlePasscodeMode, setGooglePasscodeMode] = useState(""); // "verify" or "initialize"
  const [googleTargetAcc, setGoogleTargetAcc] = useState(null);
  const [googlePasscode, setGooglePasscode] = useState("");
  const [googlePasscodeError, setGooglePasscodeError] = useState("");
  const [isListeningForEntrance, setIsListeningForEntrance] = useState(false);
  const [isSuccessBadgeVisible, setIsSuccessBadgeVisible] = useState(false);

  // Forgot Password States
  const [authForgotPasswordMode, setAuthForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newResetPassword, setNewResetPassword] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");
  const [resetStep, setResetStep] = useState(1); // 1 = Verify Email, 2 = Set New Passcode
  const [showConfirmPasswordText, setShowConfirmPasswordText] = useState(false);
  const [showResetPasswordText, setShowResetPasswordText] = useState(false);

  // Firebase Real Auth configuration states
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [showFirebaseConfigPanel, setShowFirebaseConfigPanel] = useState(false);
  const [fbApiKey, setFbApiKey] = useState("");
  const [fbAuthDomain, setFbAuthDomain] = useState("");
  const [fbProjectId, setFbProjectId] = useState("");
  const [fbAppId, setFbAppId] = useState("");
  const firebaseAuthRef = useRef(null);

  // Chat History & Floating Drawer States
  const [messages, setMessages] = useState([
    { sender: 'bot', text: "AURA-9000 systems online, Captain. Structural diagnostics check out. Starfield background coordinates scrolling. How may I assist your voyage today?" }
  ]);
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(savedProfile.isDarkMode !== false);
  const [isAccessDrawerOpen, setIsAccessDrawerOpen] = useState(false);

  // References
  const speechRecognitionRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const handleVoiceCommandRef = useRef(null);
  const lastProcessedIndexRef = useRef(-1);

  // Light/Dark mode class toggle
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
    }
  }, [isDarkMode]);

  // Sync translations & document attributes
  const t = (key) => {
    if (!translations) return key;
    return translations[lang]?.[key] || translations["en"]?.[key] || key;
  };

  // Inactivity check for session security auto-lock (5 mins)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let timeoutId;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsAuthenticated(false);
        setShowAuthModal(true);
        setIsSuccessBadgeVisible(false);
        speakFeedback("Session expired due to inactivity. Vault locked.");
      }, 300000); // 5 minutes
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [isAuthenticated]);

  // Cooldown timer countdown for brute-force prevention
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Synchronize Clerk user profile to state when active
  useEffect(() => {
    if (isClerkActive && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || "";
      const name = clerkUser.fullName || clerkUser.username || email.split("@")[0] || "User";
      setUserName(name);
      setUserEmail(email);
      setIsAuthenticated(true);
      setShowAuthModal(false);
    } else if (isClerkActive && !clerkUser) {
      setIsAuthenticated(false);
      setShowAuthModal(true);
    }
  }, [isClerkActive, clerkUser]);

  // Load Firebase config on mount if saved
  useEffect(() => {
    const savedConfigStr = localStorage.getItem("aura_firebase_config");
    if (savedConfigStr) {
      try {
        const config = JSON.parse(savedConfigStr);
        setFbApiKey(config.apiKey || "");
        setFbAuthDomain(config.authDomain || "");
        setFbProjectId(config.projectId || "");
        setFbAppId(config.appId || "");
        
        loadFirebaseSDK().then((firebase) => {
          if (!firebase.apps.length) {
            firebase.initializeApp(config);
          }
          firebaseAuthRef.current = firebase.auth();
          setIsFirebaseConnected(true);
          console.log("AURA: Saved Firebase connected successfully!");
        }).catch((err) => {
          console.error("Failed to load Firebase from local storage: ", err);
        });
      } catch (e) {
        console.error("Saved Firebase config parse failure", e);
      }
    }
  }, []);

  const handleSaveFirebaseConfig = (e) => {
    if (e) e.preventDefault();
    if (!fbApiKey || !fbAuthDomain || !fbProjectId || !fbAppId) {
      speakFeedback("Please fill out all Firebase config fields.");
      return;
    }

    const config = {
      apiKey: fbApiKey,
      authDomain: fbAuthDomain,
      projectId: fbProjectId,
      appId: fbAppId
    };

    speakFeedback("Connecting to Firebase...");
    loadFirebaseSDK().then((firebase) => {
      if (firebase.apps.length) {
        return firebase.app().delete().then(() => {
          firebase.initializeApp(config);
          firebaseAuthRef.current = firebase.auth();
          localStorage.setItem("aura_firebase_config", JSON.stringify(config));
          setIsFirebaseConnected(true);
          setShowFirebaseConfigPanel(false);
          speakFeedback("Firebase connected successfully!");
        });
      } else {
        firebase.initializeApp(config);
        firebaseAuthRef.current = firebase.auth();
        localStorage.setItem("aura_firebase_config", JSON.stringify(config));
        setIsFirebaseConnected(true);
        setShowFirebaseConfigPanel(false);
        speakFeedback("Firebase connected successfully!");
      }
    }).catch((err) => {
      console.error(err);
      speakFeedback("Failed to connect. Please verify configuration keys.");
    });
  };

  const handleDisconnectFirebase = () => {
    localStorage.removeItem("aura_firebase_config");
    setIsFirebaseConnected(false);
    setFbApiKey("");
    setFbAuthDomain("");
    setFbProjectId("");
    setFbAppId("");
    if (window.firebase && window.firebase.apps.length) {
      window.firebase.app().delete().then(() => {
        firebaseAuthRef.current = null;
        speakFeedback("Firebase disconnected. Reverted to secure local sandbox mode.");
      });
    } else {
      speakFeedback("Firebase disconnected.");
    }
  };

  // Save profile to LocalStorage
  const saveProfile = (customState = {}) => {
    const stateToSave = {
      userName,
      userEmail,
      lang,
      fontScale,
      dyslexiaMode,
      voiceNavEnabled,
      voiceGuidanceEnabled,
      colorFilter,
      autoScrollSpeed,
      isAuthenticated,
      isDarkMode,
      ...customState
    };
    localStorage.setItem("aura_react_profile", JSON.stringify(stateToSave));
  };

  // Text Scaling trigger
  useEffect(() => {
    const factor = fontScale / 100;
    document.documentElement.style.setProperty("--font-scale", factor);
  }, [fontScale]);

  // Dyslexia layout class toggle
  useEffect(() => {
    if (dyslexiaMode) {
      document.body.classList.add("dyslexia-mode");
    } else {
      document.body.classList.remove("dyslexia-mode");
    }
  }, [dyslexiaMode]);

  // Empathy color filters classes
  useEffect(() => {
    document.body.classList.remove("sim-protanopia", "sim-deuteranopia", "sim-tritanopia", "sim-achromatopsia");
    if (colorFilter !== "none") {
      document.body.classList.add(`sim-${colorFilter}`);
    }
  }, [colorFilter]);

  // Auto Scrolling animation loops
  useEffect(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    let intervalMs = 0;
    let pixels = 1;

    if (autoScrollSpeed === "slow") {
      intervalMs = 60;
    } else if (autoScrollSpeed === "medium") {
      intervalMs = 40;
    } else if (autoScrollSpeed === "fast") {
      intervalMs = 25;
    }

    if (intervalMs > 0) {
      scrollIntervalRef.current = setInterval(() => {
        const activePanelEl = document.querySelector(".workspace-panel.active");
        if (activePanelEl) {
          activePanelEl.scrollBy(0, pixels);
        }
      }, intervalMs);
    }

    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [autoScrollSpeed, activePanel]);

  // Scroll To Top Helper
  const scrollToTop = () => {
    const activePanelEl = document.querySelector(".workspace-panel.active");
    if (activePanelEl) {
      activePanelEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Continuous speech commands controller (Voice Navigation scrolling)
  useEffect(() => {
    lastProcessedIndexRef.current = -1; // Reset processing index sequence on restart
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch (e) {}
      speechRecognitionRef.current = null;
    }

    if (!voiceNavEnabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech recognition not supported in this browser.");
      setVoiceNavEnabled(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    
    // Dynamically assign speech model language to match portal translation state
    if (lang === "hi") {
      recognition.lang = "hi-IN";
    } else if (lang === "kn") {
      recognition.lang = "kn-IN";
    } else {
      recognition.lang = "en-IN";
    }

    recognition.onresult = (event) => {
      const resultIdx = event.resultIndex;
      if (resultIdx <= lastProcessedIndexRef.current) {
        return; // Deduplicate repeat events fired for the same sentence index
      }
      lastProcessedIndexRef.current = resultIdx;

      const cmd = event.results[resultIdx][0].transcript.trim();
      console.log("React Background Voice Command parsed:", cmd);
      setVoiceTranscript(cmd);
      if (handleVoiceCommandRef.current) {
        handleVoiceCommandRef.current(cmd);
      }
    };

    recognition.onend = () => {
      if (voiceNavEnabled && speechRecognitionRef.current === recognition) {
        // Wait 250ms to let the browser cleanly release the audio resource before restarting
        setTimeout(() => {
          if (voiceNavEnabled && speechRecognitionRef.current === recognition) {
            try {
              recognition.start();
              console.log("AURA Background Speech auto-restarted successfully.");
            } catch (err) {
              console.warn("Failed to restart speech engine instantly:", err);
              // Secondary fallback retry after 1 second
              setTimeout(() => {
                if (voiceNavEnabled && speechRecognitionRef.current === recognition) {
                  try {
                    recognition.start();
                    console.log("AURA Background Speech recovered and restarted.");
                  } catch (e) {
                    console.error("Speech recovery restart failed:", e);
                  }
                }
              }, 1000);
            }
          }
        }, 250);
      }
    };

    recognition.onerror = (e) => {
      console.error("Continuous Speech API error", e);
      if (e.error === "not-allowed") {
        speakFeedback("Microphone access is blocked. Please unlock microphone permissions in your browser's URL address bar.");
        setVoiceNavEnabled(false);
      }
    };

    speechRecognitionRef.current = recognition;

    // To satisfy autoplay/mic access media protection policies, we start on user gesture if needed
    let started = false;
    const tryStartSpeech = () => {
      if (started) return;
      try {
        recognition.start();
        started = true;
        console.log("Continuous speech recognition active.");
      } catch (err) {
        console.log("Speech recognition start deferred:", err);
      }
    };

    // Attempt instant activation (works if triggered by button click)
    try {
      recognition.start();
      started = true;
      console.log("Continuous speech recognition activated directly via click gesture.");
    } catch (e) {
      // Fallback: wait for the first document click or keypress
      document.addEventListener("click", tryStartSpeech, { once: true });
      document.addEventListener("keydown", tryStartSpeech, { once: true });
    }

    return () => {
      document.removeEventListener("click", tryStartSpeech);
      document.removeEventListener("keydown", tryStartSpeech);
      if (speechRecognitionRef.current === recognition) {
        try { recognition.stop(); } catch (e) {}
        speechRecognitionRef.current = null;
      }
    };
  }, [voiceNavEnabled, lang]);

  const startVoiceEntranceSession = () => {
    // Stop continuous background micro-threads first to avoid hardware collisions
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch (e) {}
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speakFeedback("Web Speech API not supported in this browser.");
      return;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    setIsListeningForEntrance(true);
    setVoiceTranscript("");
    
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-IN";

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log("AURA Single Session voice command: ", transcript);
      setVoiceTranscript(transcript);
      if (handleVoiceCommandRef.current) {
        handleVoiceCommandRef.current(transcript);
      }
    };

    rec.onend = () => {
      setIsListeningForEntrance(false);
    };

    rec.onerror = (e) => {
      console.error("Single Session Voice Error: ", e);
      setIsListeningForEntrance(false);
    };

    try {
      rec.start();
    } catch (err) {
      console.error(err);
      setIsListeningForEntrance(false);
    }
  };

  const handleVoiceSubmit = async () => {
    const mockEvent = { preventDefault: () => {} };
    await handleCredentialsSubmit(mockEvent);
  };

  const handleVoiceCommand = (text) => {
    // If not logged in, capture registration/login speech inputs
    if (!isAuthenticated) {
      const lower = text.toLowerCase();
      
      // Google Account Selector voice control commands
      if (showGoogleSelector) {
        if (lower.includes("one") || lower.includes("1") || lower.includes("first")) {
          if (googleAccounts[0]) selectGoogleAccount(googleAccounts[0]);
          return;
        }
        if (lower.includes("two") || lower.includes("2") || lower.includes("second")) {
          if (googleAccounts[1]) selectGoogleAccount(googleAccounts[1]);
          return;
        }
        if (lower.includes("three") || lower.includes("3") || lower.includes("third")) {
          if (googleAccounts[2]) selectGoogleAccount(googleAccounts[2]);
          return;
        }
        if (lower.includes("cancel") || lower.includes("close") || lower.includes("back")) {
          setShowGoogleSelector(false);
          speakFeedback("Google selector closed.");
          return;
        }
        return; // Capture speech and do not process further when selector is open
      }

      const isDictating = lower.includes("dictate") || lower.includes("email") || lower.includes("name") || lower.includes("password");
      
      if (!isDictating && (
        lower.includes("google") || 
        lower.includes("gmail") || 
        lower.includes("sign in") || 
        lower.includes("login") || 
        lower.includes("unlock")
      )) {
        handleGoogleLogin();
        return;
      }
      if (lower.includes("switch to register") || lower.includes("sign up") || lower.includes("register profile")) {
        setAuthMode("register");
        setAuthError("");
        speakFeedback("Switched to Registration form. Dictate your name, email, and password passcode.");
        return;
      }
      if (lower.includes("switch to login") || lower.includes("sign in") || lower.includes("unlock")) {
        setAuthMode("signin");
        setAuthError("");
        speakFeedback("Switched to Login form. Dictate email and password.");
        return;
      }
      if (lower.includes("dictate name")) {
        const val = lower.replace("dictate name", "").trim();
        setAuthName(val);
        speakFeedback(`Name set to ${val}`);
        return;
      }
      if (lower.includes("dictate email")) {
        let val = lower.replace("dictate email", "").trim().replace(/\s+at\s+/g, "@").replace(/\s+/g, "");
        setAuthEmail(val);
        speakFeedback(`Email set to ${val}`);
        return;
      }
      if (lower.includes("dictate password") || lower.includes("dictate key")) {
        const val = lower.replace("dictate password", "").replace("dictate key", "").trim().replace(/\s+/g, "");
        setAuthPassword(val);
        if (authMode === "register") {
          setAuthConfirmPassword(val);
        }
        speakFeedback("Password entered.");
        return;
      }
      if (lower.includes("submit") || lower.includes("login") || lower.includes("register") || lower.includes("unlock portal")) {
        handleVoiceSubmit();
        return;
      }
      return; // Do not parse other panel commands before login
    }

    const lower = text.toLowerCase();

    // 1. Menu control via speech command
    if (lower.includes("open menu") || lower.includes("show menu") || lower.includes("hamburger")) {
      window.dispatchEvent(new CustomEvent("auraSetMobileMenu", { detail: true }));
      speakFeedback("Navigation menu opened.");
      return;
    } else if (lower.includes("close menu") || lower.includes("hide menu")) {
      window.dispatchEvent(new CustomEvent("auraSetMobileMenu", { detail: false }));
      speakFeedback("Navigation menu closed.");
      return;
    }

    // 2. Scrolling (supporting dropdown menu scrolling if open)
    const isScrollUp = 
      lower.includes("scroll up") || 
      lower.includes("scrollup") || 
      lower.includes("scroll-up") || 
      lower.includes("scrolling up") || 
      lower.includes("go up") || 
      lower.includes("up") || 
      lower.includes("top") || 
      lower.includes("upar") || 
      lower.includes("ऊपर") || 
      lower.includes("mele") || 
      lower.includes("ಮೇಲೆ");

    const isScrollDown = 
      lower.includes("scroll down") || 
      lower.includes("scrolldown") || 
      lower.includes("scroll-down") || 
      lower.includes("scrolling down") || 
      lower.includes("go down") || 
      lower.includes("down") || 
      lower.includes("neeche") || 
      lower.includes("नीचे") || 
      lower.includes("kelage") || 
      lower.includes("ಕೆಳಗೆ");

    const performScroll = (offset) => {
      // Direct scrollTop coordinates writing to cleanly bypass browser CSS smooth scroll queues
      
      // 1. Accessibility drawer (if open)
      const drawer = document.querySelector(".drawer-body");
      if (drawer) {
        drawer.scrollTop += offset;
        return;
      }

      // 2. Auth settings modal card (if open)
      const modal = document.querySelector(".auth-single-card");
      if (modal) {
        modal.scrollTop += offset;
        return;
      }

      // 3. Document Reader text output pane (if visible)
      const simplifiedPane = document.querySelector(".simplified-display-pane");
      if (simplifiedPane) {
        simplifiedPane.scrollTop += offset;
      }

      // 4. Main active workspace panel content
      const activePanel = document.querySelector(".workspace-panel.active");
      if (activePanel) {
        activePanel.scrollTop += offset;
      }

      // 5. Fallback window document scrolling
      try {
        window.scrollBy(0, offset);
        document.documentElement.scrollTop += offset;
        document.body.scrollTop += offset;
      } catch (err) {
        console.warn("Fallback scrolling error:", err);
      }
    };

    console.log("AURA parsed speech command: ", lower);

    if (isScrollUp) {
      performScroll(-300);
      // Removed speakFeedback to prevent microphone feedback loop
    } else if (isScrollDown) {
      performScroll(300);
      // Removed speakFeedback to prevent microphone feedback loop
    } else if (lower.includes("scroll fast")) {
      setAutoScrollSpeed("fast");
    } else if (lower.includes("scroll slow")) {
      setAutoScrollSpeed("slow");
    } else if (lower.includes("stop scroll")) {
      setAutoScrollSpeed("none");
    } 
    
    // 3. Selection of navigation elements
    else if (lower.includes("reader") || lower.includes("document")) {
      handlePanelSwitch("panel-reader");
    } else if (lower.includes("voice") || lower.includes("assistant")) {
      handlePanelSwitch("panel-voice");
    } else if (lower.includes("map") || lower.includes("inclusion")) {
      handlePanelSwitch("panel-map");
    } else if (lower.includes("simulator") || lower.includes("simulators")) {
      handlePanelSwitch("panel-simulators");
    } else if (lower.includes("game") || lower.includes("cricket") || lower.includes("play")) {
      handlePanelSwitch("panel-game");
    } else if (lower.includes("dashboard") || lower.includes("home")) {
      handlePanelSwitch("panel-dashboard");
    }
  };

  // Sync handleVoiceCommand to reference pointer to avoid React stale closures
  handleVoiceCommandRef.current = handleVoiceCommand;

  // Save profile to LocalStorage automatically whenever preferences change
  useEffect(() => {
    if (isAuthenticated) {
      saveProfile();
    }
  }, [fontScale, dyslexiaMode, voiceNavEnabled, voiceGuidanceEnabled, colorFilter, autoScrollSpeed, lang, userName, userEmail, isDarkMode]);

  // Text-To-Speech alert feedback
  const speakFeedback = (text) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (lang === "hi") {
        utterance.lang = "hi-IN";
      } else if (lang === "kn") {
        utterance.lang = "kn-IN";
      } else {
        utterance.lang = "en-US";
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  const handlePanelSwitch = (panelId) => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    window.dispatchEvent(new Event("auraPanelSwitch"));
    setActivePanel(panelId);

    let title = "Dashboard";
    if (panelId === "panel-reader") title = "Document Reader";
    if (panelId === "panel-voice") title = "Voice Suite";
    if (panelId === "panel-map") title = "Inclusion Map";
    if (panelId === "panel-simulators") title = "Simulators";
    if (panelId === "panel-game") title = "Gully Cricket Game";
    // Disabled panel switch speakFeedback to prevent loop triggers
  };

  // Chat message send loop & parser
  const handleSendChatMessage = (queryText) => {
    const query = queryText.trim();
    if (!query) return;

    const newMsgs = [...messages, { sender: 'user', text: query }];
    setMessages(newMsgs);

    setTimeout(() => {
      const response = generateAura9000Response(query);
      setMessages(prev => [...prev, { sender: 'bot', text: response }]);
      speakFeedback(response);
    }, 600);
  };

  const generateAura9000Response = (query) => {
    const text = query.toLowerCase();

    // 1. Scale
    if (text.includes("bigger") || text.includes("increase text") || text.includes("increase scale") || text.includes("make text bigger")) {
      setFontScale(130);
      return "Engaging text magnification warp drive to 130%! Visual accessibility shields are now at maximum, Captain.";
    }
    if (text.includes("normal") || text.includes("reset text") || text.includes("smaller")) {
      setFontScale(100);
      return "Deactivating text magnification. Font scales returned to base coordinates.";
    }

    // 2. Dyslexia Mode
    if (text.includes("dyslexia") || text.includes("dyslexic") || text.includes("scramble")) {
      setDyslexiaMode(true);
      return "Recalibrating linguistic matrices. Dyslexic-friendly layouts active. Mid-word letter scramblers online.";
    }
    if (text.includes("disable dyslexia") || text.includes("remove dyslexia")) {
      setDyslexiaMode(false);
      return "Linguistic matrices restored to standard layout definitions.";
    }

    // 3. Routing
    if (text.includes("open reader") || text.includes("document reader") || text.includes("ocr")) {
      handlePanelSwitch("panel-reader");
      return "Plotting warp course to Document OCR simplifying chambers. Initializing scanner grids.";
    }
    if (text.includes("open voice") || text.includes("form filler") || text.includes("transcribe")) {
      handlePanelSwitch("panel-voice");
      return "Adjusting navigation dials to Voice Assistant Form Suite. Microphone lines active.";
    }
    if (text.includes("open map") || text.includes("inclusion map") || text.includes("helpline")) {
      handlePanelSwitch("panel-map");
      return "Initiating tactical map checks of the Indian subcontinent. State helpline databases operational.";
    }
    if (text.includes("open simulator") || text.includes("simulators")) {
      handlePanelSwitch("panel-simulators");
      return "Routing visual feeds to simulation filters and hand gesture camera sensors.";
    }
    if (text.includes("open game") || text.includes("cricket") || text.includes("play")) {
      handlePanelSwitch("panel-game");
      return "Activating digital Gully Cricket audio beep emitters. Ready for match launch, Captain.";
    }

    // 4. Color Filters
    if (text.includes("colorblind") || text.includes("red green")) {
      setColorFilter("protanopia");
      return "Protanopia red-deficiency color filter applied. Spectrum calibration checks completed.";
    }

    // 5. Help guidelines
    if (text.includes("what is") || text.includes("aura") || text.includes("portal")) {
      return "AURA-9000 is your cockpit system for accessibility. I simplify legal jargon, dictate welfare forms, track state helplines, and run beep spatial games.";
    }
    if (text.includes("how to play") || text.includes("cricket help")) {
      return "To bat, listen to the acoustic beep speed. Swing at the highest sound frequency pitch by pressing Spacebar or screaming 'Swing'.";
    }

    return "Instruction received, Captain. Diagnostic indexes normal. You can dictate 'make text bigger', 'open reader', or 'open game' to proceed.";
  };

  // Dynamic Password Strength Meter helper
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: "", color: "transparent" };
    if (pwd.length < 6) return { score: 1, label: "Weak (Min 6 chars)", color: "#ef4444" };
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
    
    if (hasLetter && hasNumber && hasSpecial && pwd.length >= 8) {
      return { score: 3, label: "Strong & Secure", color: "var(--neon-green)" };
    }
    return { score: 2, label: "Medium (Add numbers/symbols)", color: "#f97316" };
  };

  // Auth logins
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");

    if (cooldownSeconds > 0) {
      setAuthError(`Gateway locked due to multiple failures. Try again in ${cooldownSeconds} seconds.`);
      return;
    }

    // IF FIREBASE IS ACTIVE
    if (isFirebaseConnected && firebaseAuthRef.current) {
      if (authMode === "register") {
        if (authPassword !== authConfirmPassword) {
          setAuthError("Passwords do not match.");
          speakFeedback("Passwords do not match.");
          return;
        }
        try {
          speakFeedback("Registering secure database profile...");
          const userCredential = await firebaseAuthRef.current.createUserWithEmailAndPassword(authEmail, authPassword);
          const user = userCredential.user;
          await user.updateProfile({ displayName: authName });
          
          setUserName(authName || authEmail.split("@")[0]);
          setUserEmail(authEmail);
          setIsAuthenticated(true);
          setShowAuthModal(false);
          speakFeedback(`Database profile established. Welcome ${authName}!`);
        } catch (err) {
          console.error(err);
          setAuthError(err.message);
          speakFeedback("Registration failed.");
        }
      } else {
        try {
          speakFeedback("Decrypting database vault session...");
          const userCredential = await firebaseAuthRef.current.signInWithEmailAndPassword(authEmail, authPassword);
          const user = userCredential.user;
          
          setUserName(user.displayName || user.email.split("@")[0]);
          setUserEmail(user.email);
          setIsAuthenticated(true);
          setShowAuthModal(false);
          speakFeedback(`Credentials verified. Welcome back ${user.displayName || user.email}!`);
        } catch (err) {
          console.error(err);
          setAuthError(err.message);
          speakFeedback("Decryption failed.");
        }
      }
      return;
    }

    if (authMode === "register") {
      if (authPassword !== authConfirmPassword) {
        setAuthError("Passwords do not match.");
        speakFeedback("Passwords do not match.");
        return;
      }

      const strength = getPasswordStrength(authPassword);
      if (strength.score < 2) {
        setAuthError("Please create a more secure password (minimum 6 characters with letters and numbers).");
        speakFeedback("Please create a more secure password.");
        return;
      }

      try {
        // Load existing vaults database mapping
        const vaultsStr = localStorage.getItem("aura_secure_vaults");
        const vaults = vaultsStr ? JSON.parse(vaultsStr) : {};
        
        let isAlreadyRegistered = !!vaults[authEmail.toLowerCase()];
        
        // Check legacy key
        if (!isAlreadyRegistered) {
          const storedLegacy = localStorage.getItem("aura_secure_vault");
          if (storedLegacy) {
            const parsedLegacy = JSON.parse(storedLegacy);
            if (parsedLegacy.email?.toLowerCase() === authEmail.toLowerCase()) {
              isAlreadyRegistered = true;
            }
          }
        }

        if (isAlreadyRegistered) {
          setAuthError("Warning: This email address is already registered. Please sign in instead.");
          speakFeedback("Warning. This email address is already registered. Please sign in.");
          return;
        }

        const saltBytes = generateRandomBytes(16);
        const saltHex = bytesToHex(saltBytes);
        const verifierHash = await hashPassword(authPassword, saltHex);

        const payload = {
          userName: authName || authEmail.split("@")[0],
          userEmail: authEmail,
          lang: lang,
          fontScale: fontScale,
          dyslexiaMode: dyslexiaMode,
          voiceNavEnabled: voiceNavEnabled,
          voiceGuidanceEnabled: voiceGuidanceEnabled,
          colorFilter: colorFilter,
          autoScrollSpeed: autoScrollSpeed,
          isDarkMode: isDarkMode
        };

        const { ciphertext, iv } = await encryptPayload(payload, authPassword, saltHex);
        const vault = {
          email: authEmail,
          salt: saltHex,
          verifierHash,
          iv,
          ciphertext
        };

        // Save inside database mapping
        vaults[authEmail.toLowerCase()] = vault;
        localStorage.setItem("aura_secure_vaults", JSON.stringify(vaults));
        
        // For legacy single vault fallback compatibility
        localStorage.setItem("aura_secure_vault", JSON.stringify(vault));
        
        setUserName(payload.userName);
        setUserEmail(payload.userEmail);
        setIsAuthenticated(true);
        setShowAuthModal(false);
        speakFeedback(`Registration successful. Welcome ${payload.userName}`);
      } catch (err) {
        console.error(err);
        setAuthError("Error setting up secure vault profile.");
      }
    } else {
      // Sign In mode
      const vaultsStr = localStorage.getItem("aura_secure_vaults");
      const vaults = vaultsStr ? JSON.parse(vaultsStr) : {};
      let vault = vaults[authEmail.toLowerCase()];
      
      // Fallback lookup to legacy single secure vault profile key
      if (!vault) {
        const storedVaultStr = localStorage.getItem("aura_secure_vault");
        if (storedVaultStr) {
          const parsedLegacy = JSON.parse(storedVaultStr);
          if (parsedLegacy.email?.toLowerCase() === authEmail.toLowerCase()) {
            vault = parsedLegacy;
          }
        }
      }

      if (!vault) {
        setAuthError("No secure profile found for this email. Please register first.");
        speakFeedback("No secure profile found for this email. Please register.");
        return;
      }

      try {
        const enteredHash = await hashPassword(authPassword, vault.salt);

        if (enteredHash !== vault.verifierHash) {
          const nextFailedCount = failedAttempts + 1;
          if (nextFailedCount >= 3) {
            setCooldownSeconds(30);
            setFailedAttempts(0);
            setAuthError("Too many failed attempts. Security lockout active for 30 seconds.");
            speakFeedback("Too many failed attempts. Security lockout active.");
          } else {
            setFailedAttempts(nextFailedCount);
            setAuthError(`Access Denied: Invalid credentials. (${3 - nextFailedCount} attempts remaining)`);
            speakFeedback(`Access Denied. Invalid credentials. ${3 - nextFailedCount} attempts remaining.`);
          }
          return;
        }

        setFailedAttempts(0);
        const decrypted = await decryptPayload(vault.ciphertext, vault.iv, authPassword, vault.salt);
        
        // Preserve active voice assistant selections toggled during portal entrance authentication
        const finalVoiceNav = voiceNavEnabled;
        const finalVoiceGuidance = voiceGuidanceEnabled;

        // Auto-save selections to vault database if they differ from decrypted values
        if (decrypted.voiceNavEnabled !== finalVoiceNav || decrypted.voiceGuidanceEnabled !== finalVoiceGuidance) {
          decrypted.voiceNavEnabled = finalVoiceNav;
          decrypted.voiceGuidanceEnabled = finalVoiceGuidance;
          try {
            const { ciphertext, iv } = await encryptPayload(decrypted, authPassword, vault.salt);
            const updatedVault = {
              ...vault,
              iv,
              ciphertext
            };
            vaults[authEmail.toLowerCase()] = updatedVault;
            localStorage.setItem("aura_secure_vaults", JSON.stringify(vaults));
            localStorage.setItem("aura_secure_vault", JSON.stringify(updatedVault));
          } catch (e) {
            console.error("Failed to sync login preferences to vault:", e);
          }
        }

        setUserName(decrypted.userName);
        setUserEmail(decrypted.userEmail);
        setLang(decrypted.lang);
        setFontScale(decrypted.fontScale);
        setDyslexiaMode(decrypted.dyslexiaMode);
        setVoiceNavEnabled(finalVoiceNav);
        setVoiceGuidanceEnabled(finalVoiceGuidance);
        setColorFilter(decrypted.colorFilter);
        setAutoScrollSpeed(decrypted.autoScrollSpeed);
        setIsDarkMode(decrypted.isDarkMode);

        setIsAuthenticated(true);
        setShowAuthModal(false);
        speakFeedback(`Access granted. Welcome back ${decrypted.userName}`);
      } catch (err) {
        console.error(err);
        setAuthError("Decryption failed. Vault key invalid.");
        speakFeedback("Decryption failed.");
      }
    }
  };

  const handleVerifyResetEmail = (e) => {
    e.preventDefault();
    setAuthError("");
    setResetSuccessMessage("");

    if (!resetEmail) {
      setAuthError("Please enter your email address.");
      return;
    }

    const vaultsStr = localStorage.getItem("aura_secure_vaults");
    const vaults = vaultsStr ? JSON.parse(vaultsStr) : {};
    let exists = !!vaults[resetEmail.toLowerCase()];

    // Legacy fallback check
    if (!exists) {
      const storedLegacy = localStorage.getItem("aura_secure_vault");
      if (storedLegacy) {
        const parsedLegacy = JSON.parse(storedLegacy);
        if (parsedLegacy.email?.toLowerCase() === resetEmail.toLowerCase()) {
          exists = true;
        }
      }
    }

    if (!exists) {
      setAuthError("This email address is not registered.");
      speakFeedback("This email address is not registered.");
      return;
    }

    setResetStep(2);
    speakFeedback("Account email verified. Please input your new password below.");
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setResetSuccessMessage("");

    if (!resetEmail || !newResetPassword) {
      setAuthError("Please fill in all reset fields.");
      return;
    }

    const strength = getPasswordStrength(newResetPassword);
    if (strength.score < 2) {
      setAuthError("Please create a more secure password.");
      return;
    }

    const vaultsStr = localStorage.getItem("aura_secure_vaults");
    const vaults = vaultsStr ? JSON.parse(vaultsStr) : {};
    
    // Check if vault exists (can be mapping or legacy key)
    let vault = vaults[resetEmail.toLowerCase()];
    if (!vault) {
      const storedLegacy = localStorage.getItem("aura_secure_vault");
      if (storedLegacy) {
        const parsed = JSON.parse(storedLegacy);
        if (parsed.email?.toLowerCase() === resetEmail.toLowerCase()) {
          vault = parsed;
        }
      }
    }

    if (!vault) {
      setAuthError("This email address is not registered.");
      speakFeedback("Email address not registered.");
      return;
    }

    try {
      const saltBytes = generateRandomBytes(16);
      const saltHex = bytesToHex(saltBytes);
      const verifierHash = await hashPassword(newResetPassword, saltHex);

      // Set up fresh default profile state encrypted with new password
      const payload = {
        userName: resetEmail.split("@")[0],
        userEmail: resetEmail,
        lang: 'en',
        fontScale: 100,
        dyslexiaMode: false,
        voiceNavEnabled: false,
        voiceGuidanceEnabled: false,
        colorFilter: 'none',
        autoScrollSpeed: 'none',
        isDarkMode: true
      };

      const { ciphertext, iv } = await encryptPayload(payload, newResetPassword, saltHex);
      const newVault = {
        email: resetEmail,
        salt: saltHex,
        verifierHash,
        iv,
        ciphertext
      };

      vaults[resetEmail.toLowerCase()] = newVault;
      localStorage.setItem("aura_secure_vaults", JSON.stringify(vaults));
      localStorage.setItem("aura_secure_vault", JSON.stringify(newVault));

      setResetSuccessMessage("Password reset successfully! Log in with your new passcode.");
      speakFeedback("Password reset completed successfully.");
      setNewResetPassword("");
    } catch (err) {
      console.error(err);
      setAuthError("Password reset failed.");
    }
  };

  const handleGoogleLogin = () => {
    // If Firebase real database is connected, open dynamic popup auth
    if (isFirebaseConnected && firebaseAuthRef.current) {
      speakFeedback("Initializing secure Google OAuth popup window...");
      const provider = new window.firebase.auth.GoogleAuthProvider();
      firebaseAuthRef.current.signInWithPopup(provider)
        .then((result) => {
          const user = result.user;
          setUserName(user.displayName || "Google User");
          setUserEmail(user.email);
          setIsAuthenticated(true);
          setShowAuthModal(false);
          
          // Save session
          const stateToSave = {
            userName: user.displayName || "Google User",
            userEmail: user.email,
            lang,
            fontScale,
            dyslexiaMode,
            voiceNavEnabled,
            voiceGuidanceEnabled,
            colorFilter,
            autoScrollSpeed,
            isAuthenticated: true,
            isDarkMode
          };
          localStorage.setItem("aura_react_profile", JSON.stringify(stateToSave));
          speakFeedback(`Google verification completed. Welcome ${user.displayName}!`);
        })
        .catch((err) => {
          console.error(err);
          setAuthError(err.message);
          speakFeedback("Google login cancelled or failed.");
        });
      return;
    }

    // Mock Google authentication fallback from team updates
    setUserName("Guest User");
    setUserEmail("guest@codefury.com");
    setIsSuccessBadgeVisible(true);
    speakFeedback("Authenticated via Google. Welcome Guest!");
    
    // Auto-login sandbox session
    setIsAuthenticated(true);
    setShowAuthModal(false);

    // Save session
    const stateToSave = {
      userName: "Guest User",
      userEmail: "guest@codefury.com",
      lang,
      fontScale,
      dyslexiaMode,
      voiceNavEnabled,
      voiceGuidanceEnabled,
      colorFilter,
      autoScrollSpeed,
      isAuthenticated: true,
      isDarkMode
    };
    localStorage.setItem("aura_react_profile", JSON.stringify(stateToSave));
  };

  const handleLogout = () => {
    if (isClerkActive && clerkSignOut) {
      clerkSignOut();
      return;
    }
    setIsAuthenticated(false);
    setShowAuthModal(true);
    setAuthMode("signin");
    setAuthPassword("");
    setAuthConfirmPassword("");
    speakFeedback("Logged out successfully. Secure vault locked.");
  };

  return (
    <div className="app-container">
      <DynamicBackground isDarkMode={isDarkMode} />
      
      {/* SVG Empathy Filters */}
      <svg style={{ display: 'none' }}>
        <defs>
          <filter id="protanopia">
            <feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0"/>
          </filter>
          <filter id="deuteranopia">
            <feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0"/>
          </filter>
          <filter id="tritanopia">
            <feColorMatrix type="matrix" values="0.95, 0.05,  0, 0, 0, 0,  0.433, 0.567, 0, 0, 0, 0,  0.475, 0.525, 0, 0, 0, 0, 1, 0"/>
          </filter>
          <filter id="achromatopsia">
            <feColorMatrix type="matrix" values="0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 1, 0"/>
          </filter>
        </defs>
      </svg>
      
      {/* Gateway auth overlay dialog */}
      {showAuthModal && (
        <div className="modal-overlay">
          <div style={{
            width: '100%',
            maxWidth: '400px',
            padding: '36px 30px',
            background: 'rgba(15, 17, 28, 0.98)',
            border: '1.5px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 240, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            position: 'relative'
          }} className="auth-single-card">
            
            {/* Corner Close X Button - Only accessible if already logged in */}
            {isAuthenticated && (
              <button 
                type="button" 
                onClick={() => setShowAuthModal(false)} 
                style={{
                  position: 'absolute',
                  right: '18px',
                  top: '18px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  zIndex: 15,
                  color: isDarkMode ? '#94a3b8' : '#475569'
                }}
                className="auth-modal-close-x"
                title="Close Panel"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}

            {!isAuthenticated ? (
              <>
                {/* Logo and Titles */}
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '800', letterSpacing: '1px', color: '#ffffff', marginBottom: '4px', background: 'linear-gradient(90deg, #00f0ff 0%, #ff007f 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    AURA SUITE
                  </h2>
                  <p style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    {authMode === "signin" 
                      ? "Sign in to access your secure portal session." 
                      : "Create your secure portal session credentials."
                    }
                  </p>
                </div>

                {/* Accessibility Voice Toggles on Login Page */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  margin: '4px 0',
                  padding: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1.5px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px'
                }}>
                  {/* Voice Scrolling Toggler (Microphone) */}
                  <button 
                    type="button"
                    onClick={() => {
                      const nextVal = !voiceNavEnabled;
                      setVoiceNavEnabled(nextVal);
                      speakFeedback(nextVal ? "Voice navigation activated." : "Voice navigation deactivated.");
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px',
                      borderRadius: '6px',
                      border: `1px solid ${voiceNavEnabled ? 'var(--neon-green)' : 'rgba(255,255,255,0.08)'}`,
                      background: voiceNavEnabled ? 'rgba(57, 255, 20, 0.05)' : 'rgba(0,0,0,0.15)',
                      color: voiceNavEnabled ? 'var(--neon-green)' : '#94a3b8',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: voiceNavEnabled ? '0 0 8px rgba(57, 255, 20, 0.15)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <i className="fa-solid fa-microphone"></i>
                    Voice Nav
                  </button>

                  {/* Voice Guidance Toggler (Speaker) */}
                  <button 
                    type="button"
                    onClick={() => {
                      const nextVal = !voiceGuidanceEnabled;
                      setVoiceGuidanceEnabled(nextVal);
                      speakFeedback(nextVal ? "Voice guidance activated." : "Voice guidance deactivated.");
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px',
                      borderRadius: '6px',
                      border: `1px solid ${voiceGuidanceEnabled ? 'var(--neon-magenta)' : 'rgba(255,255,255,0.08)'}`,
                      background: voiceGuidanceEnabled ? 'rgba(255, 0, 127, 0.05)' : 'rgba(0,0,0,0.15)',
                      color: voiceGuidanceEnabled ? 'var(--neon-magenta)' : '#94a3b8',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: voiceGuidanceEnabled ? '0 0 8px rgba(255, 0, 127, 0.15)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <i className="fa-solid fa-volume-high"></i>
                    Voice Guide
                  </button>
                </div>

                 {authForgotPasswordMode ? (
                  // Reset Password Layout Card Content
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
                    <div style={{ textAlign: 'center' }}>
                      <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', marginBottom: '4px', background: 'linear-gradient(90deg, #00f0ff 0%, #ff007f 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        RESET PASSCODE
                      </h2>
                      <p style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                        {resetStep === 1 
                          ? "Verify your registered email address."
                          : "Enter your new access passcode."
                        }
                      </p>
                    </div>

                    {authError && (
                      <div style={{ padding: '8px 10px', background: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid #ef4444', color: '#ef4444', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold', textAlign: 'center' }}>
                        <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i> {authError}
                      </div>
                    )}

                    {resetSuccessMessage && (
                      <div style={{ padding: '8px 10px', background: 'rgba(57, 255, 20, 0.08)', border: '1.5px solid var(--neon-green)', color: 'var(--neon-green)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold', textAlign: 'center' }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i> {resetSuccessMessage}
                      </div>
                    )}

                    {resetStep === 1 ? (
                      <form onSubmit={handleVerifyResetEmail} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="auth-input-wrapper">
                          <i className="fa-solid fa-envelope"></i>
                          <input 
                            type="email" 
                            placeholder="Email Address" 
                            value={resetEmail} 
                            onChange={(e) => setResetEmail(e.target.value)} 
                            required 
                          />
                        </div>
                        
                        <button 
                          type="submit" 
                          className="primary-btn w-full" 
                          style={{ marginTop: '4px', padding: '11px', fontSize: '0.8rem', background: 'linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-magenta) 100%)', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          VERIFY ACCOUNT EMAIL
                        </button>

                        <button 
                          type="button" 
                          onClick={() => { setAuthForgotPasswordMode(false); setAuthError(""); setResetSuccessMessage(""); setResetStep(1); }}
                          className="secondary-btn w-full"
                          style={{ padding: '10px', fontSize: '0.76rem', borderRadius: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.08)', color: '#ffffff', cursor: 'pointer' }}
                        >
                          Back to Log In
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="auth-input-wrapper" style={{ opacity: 0.7 }}>
                          <i className="fa-solid fa-envelope"></i>
                          <input 
                            type="email" 
                            value={resetEmail} 
                            disabled 
                            style={{ cursor: 'not-allowed' }}
                          />
                        </div>
                        <div className="auth-input-wrapper-cyber">
                          <i className="fa-solid fa-key" style={{ color: '#94a3b8', fontSize: '0.85rem', marginRight: '10px' }}></i>
                          <input 
                            type={showResetPasswordText ? "text" : "password"} 
                            placeholder="New Password" 
                            value={newResetPassword} 
                            onChange={(e) => setNewResetPassword(e.target.value)} 
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 0', color: '#ffffff', fontSize: '0.8rem' }}
                            required 
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowResetPasswordText(!showResetPasswordText)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              margin: 0,
                              color: '#94a3b8',
                              cursor: 'pointer',
                              zIndex: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginLeft: '10px'
                            }}
                            title={showResetPasswordText ? "Hide Password" : "Show Password"}
                          >
                            <i className={`fa-regular ${showResetPasswordText ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>
                        
                        <button 
                          type="submit" 
                          className="primary-btn w-full" 
                          style={{ marginTop: '4px', padding: '11px', fontSize: '0.8rem', background: 'linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-magenta) 100%)', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          RESET PASSCODE
                        </button>

                        <button 
                          type="button" 
                          onClick={() => setResetStep(1)}
                          className="secondary-btn w-full"
                          style={{ padding: '10px', fontSize: '0.76rem', borderRadius: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.08)', color: '#ffffff', cursor: 'pointer' }}
                        >
                          Back to Verification
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Tab Toggles for Sign In / Sign Up */}
                    <div style={{
                      display: 'flex',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1.5px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px',
                      padding: '4px',
                      width: '100%'
                    }}>
                      <button
                        type="button"
                        onClick={() => { setAuthMode("signin"); setAuthError(""); }}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          fontSize: '0.76rem',
                          fontWeight: 'bold',
                          borderRadius: '8px',
                          background: authMode === "signin" ? 'rgba(255,255,255,0.08)' : 'transparent',
                          color: authMode === "signin" ? '#ffffff' : '#64748b',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthMode("register"); setAuthError(""); }}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          fontSize: '0.76rem',
                          fontWeight: 'bold',
                          borderRadius: '8px',
                          background: authMode === "register" ? 'rgba(255,255,255,0.08)' : 'transparent',
                          color: authMode === "register" ? '#ffffff' : '#64748b',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Sign Up
                      </button>
                    </div>

                    {/* Error Banner */}
                    {authError && (
                      <div style={{ padding: '8px 10px', background: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid #ef4444', color: '#ef4444', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold', textAlign: 'center' }}>
                        <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i> {authError}
                      </div>
                    )}

                    {/* Input Forms */}
                    <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {authMode === "register" && (
                        <div className="auth-input-wrapper">
                          <i className="fa-solid fa-user"></i>
                          <input 
                            type="text" 
                            placeholder="Full Name" 
                            value={authName} 
                            onChange={(e) => setAuthName(e.target.value)} 
                            required 
                          />
                        </div>
                      )}
                      <div className="auth-input-wrapper">
                        <i className="fa-solid fa-envelope"></i>
                        <input 
                          type="email" 
                          placeholder="Email Address" 
                          value={authEmail} 
                          onChange={(e) => setAuthEmail(e.target.value)} 
                          required 
                        />
                      </div>
                      <div className="auth-input-wrapper-cyber">
                        <i className="fa-solid fa-key" style={{ color: '#94a3b8', fontSize: '0.85rem', marginRight: '10px' }}></i>
                        <input 
                          type={showPasswordText ? "text" : "password"} 
                          placeholder="Password" 
                          value={authPassword} 
                          onChange={(e) => setAuthPassword(e.target.value)} 
                          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 0', color: '#ffffff', fontSize: '0.8rem' }}
                          required 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPasswordText(!showPasswordText)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            margin: 0,
                            color: '#94a3b8',
                            cursor: 'pointer',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: '10px'
                          }}
                          title={showPasswordText ? "Hide Password" : "Show Password"}
                        >
                          <i className={`fa-regular ${showPasswordText ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                      
                      {authMode === "signin" && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
                          <button 
                            type="button" 
                            onClick={() => { setAuthForgotPasswordMode(true); setResetEmail(authEmail); setAuthError(""); setResetStep(1); }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--neon-cyan)',
                              fontSize: '0.68rem',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              textDecoration: 'underline'
                            }}
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}
                      
                      {authMode === "register" && (
                        <>
                          {authPassword && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '-3px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#94a3b8' }}>
                                <span>Password Strength:</span>
                                <span style={{ color: getPasswordStrength(authPassword).color, fontWeight: 'bold' }}>{getPasswordStrength(authPassword).label}</span>
                              </div>
                              <div style={{ height: '3px', width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${(getPasswordStrength(authPassword).score / 3) * 100}%`, background: getPasswordStrength(authPassword).color, transition: 'all 0.3s ease' }}></div>
                              </div>
                            </div>
                          )}
                          
                          <div className="auth-input-wrapper-cyber">
                            <i className="fa-solid fa-circle-check" style={{ color: '#94a3b8', fontSize: '0.85rem', marginRight: '10px' }}></i>
                            <input 
                              type={showConfirmPasswordText ? "text" : "password"} 
                              placeholder="Confirm Password" 
                              value={authConfirmPassword} 
                              onChange={(e) => setAuthConfirmPassword(e.target.value)} 
                              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 0', color: '#ffffff', fontSize: '0.8rem' }}
                              required 
                            />
                            <button 
                              type="button" 
                              onClick={() => setShowConfirmPasswordText(!showConfirmPasswordText)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                margin: 0,
                                color: '#94a3b8',
                                cursor: 'pointer',
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: '10px'
                              }}
                              title={showConfirmPasswordText ? "Hide Password" : "Show Password"}
                            >
                              <i className={`fa-regular ${showConfirmPasswordText ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                          </div>
                        </>
                      )}
                      
                      <button 
                        type="submit" 
                        className="primary-btn w-full" 
                        style={{ marginTop: '6px', padding: '11px', fontSize: '0.8rem', background: 'linear-gradient(90deg, var(--neon-cyan) 0%, var(--neon-magenta) 100%)', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', letterSpacing: '0.5px' }}
                        disabled={cooldownSeconds > 0}
                      >
                        {cooldownSeconds > 0 
                          ? `Locked (${cooldownSeconds}s)` 
                          : (authMode === "signin" ? "LOG IN" : "REGISTER SESSION")
                        }
                      </button>
                    </form>

                    {/* Separator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0' }}>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
                      <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 'bold' }}>OR CONTINUE WITH</span>
                      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
                    </div>

                    {/* Google Login button */}
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '11px',
                        borderRadius: '10px',
                        border: '1.5px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(255, 255, 255, 0.01)',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; }}
                    >
                      <i className="fa-brands fa-google" style={{ color: '#ea4335', fontSize: '0.95rem' }}></i>
                      Sign in with Google
                    </button>
                  </>
                )}
              </>
            ) : (
              // If authenticated, show simple user profile settings (Logout button)
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <i className="fa-solid fa-user-astronaut text-accent" style={{ color: 'var(--neon-cyan)', fontSize: '2rem', marginBottom: '8px' }}></i>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>Account Settings</h2>
                  <p style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Profile Cryptographic Vault status: Unlocked</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="auth-settings-info-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>User Name:</span>
                      <strong>{userName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>Email Address:</span>
                      <strong>{userEmail}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span>Vault Ciphertext:</span>
                      <span className="cipher-text-val" style={{ fontFamily: 'monospace', fontSize: '0.68rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const val = localStorage.getItem("aura_secure_vault");
                          if (!val) return "OAuth Sim Token";
                          try {
                            const parsed = JSON.parse(val);
                            return parsed && parsed.ciphertext ? parsed.ciphertext : "OAuth Sim Token";
                          } catch (e) {
                            return "OAuth Sim Token";
                          }
                        })()}
                      </span>
                    </div>
                  </div>

                  <button 
                    type="button" 
                    onClick={handleLogout} 
                    className="primary-btn btn-magenta w-full"
                    style={{ marginTop: '12px' }}
                  >
                    <i className="fa-solid fa-power-off"></i> Lock Vault & Logout
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setShowAuthModal(false)} 
                    className="secondary-btn w-full"
                  >
                    Close Settings Dashboard
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <TopNavbar 
        activePanel={activePanel} 
        onPanelSwitch={handlePanelSwitch} 
        t={t}
        openAuthModal={() => {
          setShowAuthModal(true);
        }}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        voiceNavEnabled={voiceNavEnabled}
        setVoiceNavEnabled={setVoiceNavEnabled}
        voiceGuidanceEnabled={voiceGuidanceEnabled}
        setVoiceGuidanceEnabled={setVoiceGuidanceEnabled}
        speakFeedback={speakFeedback}
        isClerkActive={isClerkActive}
        clerkUserButton={clerkUserButton}
      />

      {/* Floating Accessibility Trigger Widget */}
      <button 
        type="button" 
        className="floating-accessibility-btn" 
        onClick={() => setIsAccessDrawerOpen(!isAccessDrawerOpen)}
        title="Open Accessibility Controls"
      >
        <i className="fa-solid fa-universal-access"></i>
        {voiceNavEnabled && (
          <span className="floating-voice-active-pill" title="AURA Voice Engine Active">
            <span className="voice-pulse-ring"></span>
            <i className="fa-solid fa-microphone" style={{ fontSize: '0.52rem', color: '#050609' }}></i>
          </span>
        )}
      </button>

      {/* Collapsible Left Side Accessibility drawer */}
      {isAccessDrawerOpen && (
        <div className="accessibility-side-drawer">
          <div className="drawer-header">
            <h4><i className="fa-solid fa-universal-access"></i> Accessibility Console</h4>
            <button type="button" onClick={() => setIsAccessDrawerOpen(false)} className="compact-close-btn">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="drawer-body">
            
            {/* Color Filter */}
            <div className="drawer-group">
              <label><i className="fa-solid fa-eye"></i> Colorblind Spectrum</label>
              <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}>
                <option value="none">Normal Spectrum</option>
                <option value="protanopia">Protanopia (Red-Blind)</option>
                <option value="deuteranopia">Deuteranopia (Green-Blind)</option>
                <option value="tritanopia">Tritanopia (Blue-Blind)</option>
                <option value="achromatopsia">Achromatopsia (Monochrome)</option>
              </select>
            </div>

            {/* Dyslexia Mode */}
            <div className="drawer-group switch-row-drawer">
              <label><strong>Dyslexia Layout Font</strong></label>
              <label className="switch">
                <input type="checkbox" checked={dyslexiaMode} onChange={(e) => setDyslexiaMode(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            {/* Voice Scrolling */}
            <div className="drawer-group switch-row-drawer">
              <label><strong>Voice Navigation Scrolling</strong></label>
              <label className="switch">
                <input type="checkbox" checked={voiceNavEnabled} onChange={(e) => setVoiceNavEnabled(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>

            {/* Text Sizing */}
            <div className="drawer-group">
              <label><i className="fa-solid fa-magnifying-glass-plus"></i> Text Magnification</label>
              <div className="drawer-scale-adjuster">
                <button type="button" onClick={() => setFontScale(Math.max(100, fontScale - 10))}>A-</button>
                <span>{fontScale}%</span>
                <button type="button" onClick={() => setFontScale(Math.min(180, fontScale + 10))}>A+</button>
              </div>
            </div>

            {/* Language Selection */}
            <div className="drawer-group">
              <label><i className="fa-solid fa-language"></i> Language</label>
              <div className="drawer-lang-buttons">
                <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button>
                <button className={lang === 'hi' ? 'active' : ''} onClick={() => setLang('hi')}>हिन्दी</button>
                <button className={lang === 'kn' ? 'active' : ''} onClick={() => setLang('kn')}>ಕನ್ನಡ</button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Main Panel Viewport */}
      <main className="main-workspace">
        {/* Dynamic Workspace Panels */}
        <div className={`workspace-panel ${activePanel === 'panel-dashboard' ? 'active' : ''}`}>
          <Dashboard 
            userName={userName} 
            t={t} 
            onPanelSwitch={handlePanelSwitch}
            voiceNavEnabled={voiceNavEnabled}
            setVoiceNavEnabled={setVoiceNavEnabled}
            voiceGuidanceEnabled={voiceGuidanceEnabled}
            speakFeedback={speakFeedback}
          />
        </div>

        <div className={`workspace-panel ${activePanel === 'panel-reader' ? 'active' : ''}`}>
          <DocumentReader t={t} lang={lang} speakFeedback={speakFeedback} />
        </div>

        <div className={`workspace-panel ${activePanel === 'panel-voice' ? 'active' : ''}`}>
          <VoiceSuite t={t} lang={lang} speakFeedback={speakFeedback} />
        </div>

        <div className={`workspace-panel ${activePanel === 'panel-map' ? 'active' : ''}`}>
          <InclusionMap t={t} lang={lang} speakFeedback={speakFeedback} />
        </div>

        <div className={`workspace-panel ${activePanel === 'panel-simulators' ? 'active' : ''}`}>
          <Simulators t={t} speakFeedback={speakFeedback} />
        </div>

        <div className={`workspace-panel ${activePanel === 'panel-game' ? 'active' : ''}`}>
          <GullyGame t={t} isAuthenticated={isAuthenticated} speakFeedback={speakFeedback} activePanel={activePanel} />
        </div>

      </main>

      {/* ================= OMNIPRESENT FLOATING CHAT COMPANION ================= */}
      {isAuthenticated && (
        <>
          {/* Floating Hologram Orb Button */}
          <button 
            type="button"
            className="floating-holo-orb-btn"
            onClick={() => setIsFloatingChatOpen(!isFloatingChatOpen)}
            title="Toggle AURA Companion Chat"
          >
            <div className="floating-orb-outer"></div>
            <div className="floating-orb-inner"></div>
            <i className="fa-solid fa-robot"></i>
          </button>

          {/* Floating Glass Chat Drawer */}
          {isFloatingChatOpen && (
            <div className="floating-chat-drawer">
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '6px' }}>
                <button 
                  type="button" 
                  className="compact-btn" 
                  style={{ padding: '2px 8px', borderColor: 'var(--neon-magenta)', color: 'var(--neon-magenta)' }}
                  onClick={() => setIsFloatingChatOpen(false)}
                >
                  <i className="fa-solid fa-xmark"></i> Close
                </button>
              </div>
              <ChatBotWidget 
                messages={messages}
                onSendMessage={handleSendChatMessage}
                speakFeedback={speakFeedback}
                t={t}
              />
            </div>
          )}

          {/* Floating Back to Top button */}
          <button 
            type="button" 
            className="floating-back-to-top-btn" 
            onClick={scrollToTop} 
            title="Scroll to Top"
          >
            <i className="fa-solid fa-chevron-up"></i>
          </button>
        </>
      )}


    </div>
  );
}
