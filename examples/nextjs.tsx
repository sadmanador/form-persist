"use client"

// Next.js — form-persist detects SSR automatically.
// On the server it uses MemoryDriver (no-op); on the client it uses localStorage.
// No "window is not defined" errors, no extra guards needed.

import { useState } from "react"
import { useFormPersist } from "form-persist/react"

interface RegistrationData {
  firstName: string
  lastName: string
  email: string
  organisation: string
}

export default function RegistrationPage() {
  const [formData, setFormData] = useState<RegistrationData>({
    firstName: "",
    lastName: "",
    email: "",
    organisation: "",
  })

  const { save, restore, clear, reset, hasData, isRestored, timeRemaining } = useFormPersist({
    key: "registration-form",
    ttl: "24h",
    storage: "localStorage",   // safely ignored on server, used on client
    clearOnSubmit: true,
    exclude: [],
    onRestore: (saved) => {
      const data = saved.steps[0]?.data as RegistrationData | undefined
      if (data) setFormData(data)
    },
    onExpire: () => {
      alert("Your saved registration data has expired. Please fill the form again.")
    },
  })

  const minutesLeft = timeRemaining ? Math.ceil(timeRemaining / 60000) : null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...formData, [e.target.name]: e.target.value }
    setFormData(updated)
    void save(0, updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })
    if (res.ok) {
      await clear("submit")
    }
  }

  return (
    <main>
      {hasData && !isRestored && (
        <div className="banner">
          <p>
            You have a saved draft.
            {minutesLeft !== null && ` Expires in ${minutesLeft} min.`}
          </p>
          <button onClick={restore}>Continue draft</button>
          <button onClick={reset}>Start fresh</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <h1>Registration</h1>
        <input
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          placeholder="First name"
          required
        />
        <input
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          placeholder="Last name"
          required
        />
        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          required
        />
        <input
          name="organisation"
          value={formData.organisation}
          onChange={handleChange}
          placeholder="Organisation"
        />
        <button type="submit">Register</button>
      </form>
    </main>
  )
}
