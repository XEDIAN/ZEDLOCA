// Example version — add this logic when registering users:
const newUser = {
  email,
  password,
  role: 'buyer' // or 'seller' depending on the form
}

// Save to localStorage
const existingUsers = JSON.parse(localStorage.getItem('users')) || []
localStorage.setItem('users', JSON.stringify([...existingUsers, newUser]))

onSignup(newUser)