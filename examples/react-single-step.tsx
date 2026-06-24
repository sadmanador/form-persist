import React, { useState } from "react"
import { useFormPersist } from "form-persist/react"

interface FormData {
  name: string
  email: string
  message: string
}

export default function ContactForm() {
  const [formData, setFormData] = useState<FormData>({ name: "", email: "", message: "" })

  const { save, restore, clear, hasData, isRestored } = useFormPersist({
    key: "contact-form",
    ttl: "24h",
    clearOnSubmit: true,
    onRestore: (saved) => {
      const data = saved.steps[0]?.data as FormData | undefined
      if (data) setFormData(data)
    },
    onExpire: () => {
      alert("Your saved draft expired. Starting fresh.")
    },
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const updated = { ...formData, [e.target.name]: e.target.value }
    setFormData(updated)
    void save(0, updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch("/api/contact", { method: "POST", body: JSON.stringify(formData) })
    await clear("submit")
    setFormData({ name: "", email: "", message: "" })
    alert("Sent!")
  }

  return (
    <div>
      {hasData && !isRestored && (
        <div className="banner">
          <p>You have a saved draft.</p>
          <button onClick={restore}>Continue draft</button>
          <button onClick={() => clear("manual")}>Discard</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Name"
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
        <textarea
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Message"
          required
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
