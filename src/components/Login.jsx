import { useState } from 'react'

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const handleLogin = () => {
    const users = JSON.parse(localStorage.getItem('users')) || []
    const match = users.find(u => u.email === email && u.password === password)

    if (match) {
      const userWithRole = { ...match, role: match.role || 'buyer' }
      onLogin(userWithRole)
    } else {
      setError('Invalid email or password')
    }
  }

  return (
    <div className="bg-white p-4 rounded-md shadow mt-6 max-w-md mx-auto">
      <h3 className="text-xl font-semibold mb-2 text-center text-indigo-700">Login</h3>
      <input
        className="w-full mb-2 p-2 border border-gray-300 rounded"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full mb-2 p-2 border border-gray-300 rounded"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded mt-2"
        onClick={handleLogin}
      >
        Log In
      </button>
    </div>
  )
}

export default Login