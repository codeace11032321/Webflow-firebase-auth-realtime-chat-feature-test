// ============================/////============================/////============================///
// Initialize Firebase
// ============================/////============================///

// Import Firebase modules
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// Firebase config
const firebaseConfig = {
  apiKey: 'AIzaSyA6fI-AowLHQAWBHRh2zT1qK7uHvmlNFCw',
  authDomain: 'webchats-8067b.firebaseapp.com',
  databaseURL: 'https://webchats-8067b-default-rtdb.firebaseio.com',
  projectId: 'webchats-8067b',
  storageBucket: 'webchats-8067b.appspot.com',
  messagingSenderId: '317012666683',
  appId: '1:317012666683:web:e421f4ca9e53dcdb06ef1e',
  measurementId: 'G-7TJ2H7CGEX',
}

// Initialize Firebase app and services
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const firestore = getFirestore(app)
const storage = getStorage(app)

// ============================/////============================///
// DOM Elements
// ============================/////============================///

const signUpForm = document.getElementById('wf-form-signup-form')
const signInForm = document.getElementById('wf-form-signin-form')
const signOutButton = document.getElementById('signout-button')
const onboardingForm = document.getElementById('onboarding-form')
const uploaderButton = document.querySelector(
  '[data-ms-action="profile-uploader"]'
)
const fileInput = createFileInput()

// ============================/////============================///
// Add Event Listeners
// ============================/////============================///

addEventListenerWithTracking(signUpForm, 'submit', handleSignUp)
addEventListenerWithTracking(signInForm, 'submit', handleSignIn)
addEventListenerWithTracking(signOutButton, 'click', handleSignOut)
addEventListenerWithTracking(onboardingForm, 'submit', handleOnboardingSubmit)
addEventListenerWithTracking(uploaderButton, 'click', () => fileInput.click())
addEventListenerWithTracking(fileInput, 'change', updateProfilePicture)

// ============================/////============================///
// Helper Functions
// ============================/////============================///

function createFileInput() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.display = 'none'
  document.body.appendChild(input)
  return input
}

function addEventListenerWithTracking(element, event, handler) {
  if (element) {
    element.addEventListener(event, handler)
  }
}

// ============================/////============================///
// Auth Flow Functions
// ============================/////============================///
async function handleSignUp(e) {
  e.preventDefault()
  e.stopPropagation()

  const email = document.getElementById('signup-email').value
  const password = document.getElementById('signup-password').value

  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    )
    const user = userCredential.user
    sendVerificationEmail()
    console.log(`Signed up user: ${user.email}`)

    window.location.href = `/app/onboarding?authtoken=${userCredential.user.refreshToken}`
  } catch (error) {
    displayErrorMessage('signup-error-message', error.message)
  }
}

async function handleSignIn(e) {
  if (e) {
    e.preventDefault()
    e.stopPropagation()
  }

  const email = document.getElementById('signin-email').value
  const password = document.getElementById('signin-password').value

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    )
    const user = userCredential.user

    if (user.emailVerified) {
      window.location.href = '/'
    } else {
      handleUnverifiedUser(user)
    }
  } catch (error) {
    displayErrorMessage('signin-error-message', error.message)
  }
}

async function handleSignOut() {
  try {
    await signOut(auth)
    clearUserProfileCache()
    console.log('User signed out')
  } catch (error) {
    console.log('Error signing out:', error.message)
  }
}

function handleUnverifiedUser(user) {
  const uid = user.uid

  getDoc(doc(firestore, 'users', uid))
    .then((docSnapshot) => {
      if (docSnapshot.exists()) {
        const userProfile = docSnapshot.data()
        if (!userProfile.name) {
          window.location.href = '/app/onboarding'
        } else {
          window.location.href = '/verification'
        }
        return
      } else {
        window.location.href = '/app/onboarding'
      }
    })
    .catch((error) => {
      console.error('Error retrieving user profile:', error)
      window.location.href = '/app/onboarding'
    })
}

async function sendVerificationEmail() {
  const user = auth.currentUser
  if (user) {
    try {
      await sendEmailVerification(user)
      console.log('Verification email sent!')
    } catch (error) {
      console.error('Error sending verification email:', error)
    }
  }
}

async function handleOnboardingSubmit(e) {
  e.preventDefault()
  e.stopPropagation()

  const uid = auth.currentUser?.uid
  if (uid) {
    await handleOnboarding(uid)
  } else {
    console.error('User is not authenticated')
  }
}

async function handleOnboarding(uid) {
  const name = document.getElementById('onboarding-name').value
  const bio = document.getElementById('onboarding-bio').value

  const docSnapshot = await getDoc(doc(firestore, 'users', uid))
  const pictureUrl = docSnapshot.exists()
    ? docSnapshot.data().profilePicUrl
    : 'https://cdn.prod.website-files.com/660b73627785bc0aadaee0c8/660b77e1ab76e57af2b77f88_white-profile-empty%20(1).svg'

  const userProfile = {
    name,
    email: auth.currentUser.email,
    pictureUrl,
    bio,
    uid,
    createdAt: new Date(),
  }

  try {
    await setDoc(doc(firestore, 'users', uid), userProfile)
    console.log('User profile created successfully!')
    window.location.href = '/verification'
  } catch (error) {
    console.error('Error creating user profile:', error)
  }
}

// ============================/////============================///
// Utility Functions
// ============================/////============================///

function displayErrorMessage(elementId, message) {
  const errorText = document.getElementById(elementId)
  if (errorText) {
    errorText.innerHTML = message
  }
}

async function updateProfilePicture() {
  const currentUser = auth.currentUser
  if (!currentUser || !fileInput.files.length) {
    console.error('No user logged in or no file selected.')
    return
  }

  const file = fileInput.files[0]
  const storageRef = ref(
    storage,
    `profile_pictures/${currentUser.uid}/${file.name}`
  )

  try {
    await uploadBytes(storageRef, file)
    console.log('File uploaded successfully!')

    const url = await getDownloadURL(storageRef)
    updateUserProfilePicture(url)
    await setDoc(doc(firestore, 'users', currentUser.uid), {
      profilePicUrl: url,
    })
    console.log('Profile picture URL updated in Firestore')
  } catch (error) {
    console.error('Error uploading file:', error.message)
    alert(
      'Something went wrong while uploading your profile picture. Please try again later.'
    )
  }
}

function updateUserProfilePicture(url) {
  const profileImage = document.querySelector(
    'img[data-ms-member="profile-image"]'
  )
  const profilePicUrlInput = document.querySelector(
    'input[data-ms-member="profile-pic-url"]'
  )

  if (profileImage) {
    profileImage.src = url
  }
  if (profilePicUrlInput) {
    profilePicUrlInput.value = url
  }
}

// ============================/////============================///
// Cache Management and UI Updates
// ============================/////============================///

function clearUserProfileCache() {
  const user = auth.currentUser
  if (user) {
    localStorage.removeItem(`userProfile_${user.uid}`)
  }
}

async function setUserProfileAttributes(uid) {
  const cachedProfile = JSON.parse(localStorage.getItem(`userProfile_${uid}`))

  if (cachedProfile) {
    updateUIWithUserProfile(cachedProfile)
    return
  }

  try {
    const userDocRef = doc(firestore, 'users', uid)
    const userDoc = await getDoc(userDocRef)

    if (userDoc.exists()) {
      const userProfile = userDoc.data()
      localStorage.setItem(`userProfile_${uid}`, JSON.stringify(userProfile))
      updateUIWithUserProfile(userProfile)
      console.log('User profile attributes set successfully')
    } else {
      console.error('User profile does not exist')
    }
  } catch (error) {
    console.error('Error fetching user profile:', error)
  }
}

function updateUIWithUserProfile(userProfile) {
  const nameElement = document.querySelector('[data-ms-doc="name"]')
  const profilePicElement = document.querySelector(
    '[data-ms-doc="profilepicurl"]'
  )
  const emailElement = document.querySelector('[data-ms-doc="email"]')
  const bioElement = document.querySelector('[data-ms-doc="bio"]')
  const navprofileElement = document.querySelector(
    '[data-ms-doc="nav-profile"]'
  )

  if (nameElement) nameElement.textContent = userProfile.name || ''
  if (profilePicElement) profilePicElement.src = userProfile.pictureUrl || ''
  if (navprofileElement)
    navprofileElement.style.backgroundImage = `url(${
      userProfile.pictureUrl || ''
    })`
  if (emailElement) emailElement.textContent = userProfile.email || ''
  if (bioElement) bioElement.textContent = userProfile.bio || ''
}

// ============================/////============================///
// Authentication State Management
// ============================/////============================///

onAuthStateChanged(auth, (user) => {
  const publicElements = document.querySelectorAll("[data-onlogin='hide']")
  const privateElements = document.querySelectorAll("[data-onlogin='show']")

  if (user) {
    setUserProfileAttributes(user.uid)
    toggleLoginStateElements(privateElements, publicElements, true)
    checkEmailVerification(user)
    displayUserEmailAndUUID()

    if (!user.emailVerified) {
      waitForEmailVerification()
    }
  } else {
    toggleLoginStateElements(privateElements, publicElements, false)
  }
})

function checkEmailVerification(user) {
  if (!user.emailVerified) {
    console.log('Email not verified.')

    if (
      window.location.pathname !== '/verification' &&
      window.location.pathname !== '/app/onboarding'
    ) {
      window.location.href = '/verification'
    }
    return
  } else if (
    user.emailVerified &&
    window.location.pathname == '/verification'
  ) {
    window.location.href = '/'
    console.log('Email is verified.')
  } else {
    return
  }
}

function toggleLoginStateElements(privateElements, publicElements, isLoggedIn) {
  privateElements.forEach((element) => {
    element.style.display = isLoggedIn ? 'initial' : 'none'
  })
  publicElements.forEach((element) => {
    element.style.display = isLoggedIn ? 'none' : 'initial'
  })
}

function displayUserEmailAndUUID() {
  const profileEmail = document.querySelector('input[data-ms-member="email"]')
  const profileUUID = document.querySelector('input[data-ms-member="uuid"]')
  const currentUser = auth.currentUser

  if (currentUser) {
    localStorage.setItem('userEmail', currentUser.email)
    localStorage.setItem('userUUID', currentUser.uid)

    if (profileEmail) {
      profileEmail.value = currentUser.email
    }
    if (profileUUID) {
      profileUUID.value = currentUser.uid
    }
  }
}

async function waitForEmailVerification() {
  const user = auth.currentUser

  if (user && !user.emailVerified) {
    try {
      await user.reload()

      if (user.emailVerified) {
        window.location.reload()
      } else {
        setTimeout(waitForEmailVerification, 2000)
      }
    } catch (error) {
      console.error('Error reloading user:', error)
    }
  }
}

const messagesList = document.getElementById('messagesList')
const messageForm = document.getElementById('messageForm')
const messageInput = document.getElementById('messageInput')

// Function to get user profile data
const getUserProfile = async (uid) => {
  const userDoc = doc(firestore, 'users', uid)
  const docSnapshot = await getDoc(userDoc)
  if (docSnapshot.exists()) {
    return docSnapshot.data()
  } else {
    console.error('User profile not found')
    return null
  }
}

// Function to send messages
const sendMessage = async (e) => {
  e.preventDefault()
  e.stopPropagation()

  const user = auth.currentUser
  if (!user) {
    console.error('User not authenticated')
    return
  }

  const messageText = messageInput.value.trim()

  if (!messageText) {
    console.error('Message input is empty')
    return
  }

  // Get user profile to fetch pictureUrl
  const userProfile = await getUserProfile(user.uid)
  const photoURL = userProfile ? userProfile.pictureUrl : 'default_image_url'

  try {
    await addDoc(collection(firestore, 'messages'), {
      text: messageText,
      createdAt: new Date(),
      uid: user.uid,
      photoURL: photoURL,
    })
    messageInput.value = '' // Clear input after sending
  } catch (error) {
    console.error('Error adding document: ', error)
  }
}

// Listen for new messages in real-time
const messagesQuery = query(
  collection(firestore, 'messages'),
  orderBy('createdAt', 'asc'),
  limit()
)
onSnapshot(messagesQuery, (querySnapshot) => {
  messagesList.innerHTML = ''
  querySnapshot.forEach((doc) => {
    const msg = doc.data()
    const messageClass = msg.uid === auth.currentUser.uid ? 'sent' : 'received'
    const messageElement = document.createElement('div')
    messageElement.classList.add('message', messageClass)
    messageElement.innerHTML = `
  <img src="${
    msg.photoURL || 'default_image_url'
  }" alt="User Avatar" style="width: 40px; height: 40px; border-radius: 50%;" />
  <p>${msg.text}</p>
  `
    messagesList.appendChild(messageElement)
  })
  messagesList.scrollTop = messagesList.scrollHeight
})

// Add event listener to the form
messageForm.addEventListener('submit', sendMessage)

if (messageForm) {
  messageForm.addEventListener('submit', sendMessage)
} else {
  console.warn('Message form not found, listener not added.')
}
