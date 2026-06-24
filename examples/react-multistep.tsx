import React, { useState } from "react"
import { useFormPersist } from "form-persist/react"

// DGHS vaccine arrival report — 4-step multi-step form example

interface Step0Data { facilityCode: string; arrivalDate: string }
interface Step1Data { batchNumber: string; quantity: number; manufacturer: string }
interface Step2Data { coldChainOk: boolean; visualInspectionOk: boolean; notes: string }
interface Step3Data { verifiedBy: string; signature: string }

export default function VaccineArrivalForm() {
  const [step0, setStep0] = useState<Step0Data>({ facilityCode: "", arrivalDate: "" })
  const [step1, setStep1] = useState<Step1Data>({ batchNumber: "", quantity: 0, manufacturer: "" })
  const [step2, setStep2] = useState<Step2Data>({ coldChainOk: false, visualInspectionOk: false, notes: "" })
  const [step3, setStep3] = useState<Step3Data>({ verifiedBy: "", signature: "" })

  const {
    completeStep,
    save,
    clear,
    reset,
    currentStep,
    hasData,
    isRestored,
    timeRemaining,
    restore,
  } = useFormPersist({
    key: "vaccine-arrival-report",
    steps: 4,
    ttl: "24h",
    clearOnSubmit: true,
    onRestore: (saved) => {
      if (saved.steps[0]) setStep0(saved.steps[0].data as Step0Data)
      if (saved.steps[1]) setStep1(saved.steps[1].data as Step1Data)
      if (saved.steps[2]) setStep2(saved.steps[2].data as Step2Data)
      if (saved.steps[3]) setStep3(saved.steps[3].data as Step3Data)
    },
    onExpire: () => alert("Your saved form data has expired. Please start again."),
  })

  const hoursLeft = timeRemaining ? Math.floor(timeRemaining / 3600000) : null

  const handleStep0Submit = async () => {
    await completeStep(0, step0)
  }

  const handleStep1Submit = async () => {
    await completeStep(1, step1)
  }

  const handleStep2Submit = async () => {
    await completeStep(2, step2)
  }

  const handleFinalSubmit = async () => {
    await fetch("/api/vaccine-arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step0, step1, step2, step3 }),
    })
    await clear("submit")
    alert("Report submitted!")
  }

  return (
    <div>
      {hasData && !isRestored && (
        <div className="restore-banner">
          <p>You have saved progress from a previous session (Step {currentStep + 1} of 4).</p>
          {hoursLeft !== null && <p>Expires in {hoursLeft} hours.</p>}
          <button onClick={restore}>Continue where I left off</button>
          <button onClick={reset}>Start fresh</button>
        </div>
      )}

      <div className="step-indicator">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={currentStep === i ? "active" : currentStep > i ? "done" : ""}>
            Step {i + 1}
          </span>
        ))}
      </div>

      {currentStep === 0 && (
        <div>
          <h2>Step 1: Facility &amp; Arrival</h2>
          <input
            placeholder="Facility Code"
            value={step0.facilityCode}
            onChange={(e) => {
              const updated = { ...step0, facilityCode: e.target.value }
              setStep0(updated)
              void save(0, updated)
            }}
          />
          <input
            type="date"
            value={step0.arrivalDate}
            onChange={(e) => {
              const updated = { ...step0, arrivalDate: e.target.value }
              setStep0(updated)
              void save(0, updated)
            }}
          />
          <button onClick={handleStep0Submit}>Next</button>
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <h2>Step 2: Batch Information</h2>
          <input
            placeholder="Batch Number"
            value={step1.batchNumber}
            onChange={(e) => {
              const updated = { ...step1, batchNumber: e.target.value }
              setStep1(updated)
              void save(1, updated)
            }}
          />
          <input
            type="number"
            placeholder="Quantity"
            value={step1.quantity}
            onChange={(e) => {
              const updated = { ...step1, quantity: Number(e.target.value) }
              setStep1(updated)
              void save(1, updated)
            }}
          />
          <input
            placeholder="Manufacturer"
            value={step1.manufacturer}
            onChange={(e) => {
              const updated = { ...step1, manufacturer: e.target.value }
              setStep1(updated)
              void save(1, updated)
            }}
          />
          <button onClick={handleStep1Submit}>Next</button>
        </div>
      )}

      {currentStep === 2 && (
        <div>
          <h2>Step 3: Inspection</h2>
          <label>
            <input
              type="checkbox"
              checked={step2.coldChainOk}
              onChange={(e) => {
                const updated = { ...step2, coldChainOk: e.target.checked }
                setStep2(updated)
                void save(2, updated)
              }}
            />
            Cold chain maintained
          </label>
          <label>
            <input
              type="checkbox"
              checked={step2.visualInspectionOk}
              onChange={(e) => {
                const updated = { ...step2, visualInspectionOk: e.target.checked }
                setStep2(updated)
                void save(2, updated)
              }}
            />
            Visual inspection passed
          </label>
          <textarea
            placeholder="Notes"
            value={step2.notes}
            onChange={(e) => {
              const updated = { ...step2, notes: e.target.value }
              setStep2(updated)
              void save(2, updated)
            }}
          />
          <button onClick={handleStep2Submit}>Next</button>
        </div>
      )}

      {currentStep === 3 && (
        <div>
          <h2>Step 4: Verification</h2>
          <input
            placeholder="Verified by"
            value={step3.verifiedBy}
            onChange={(e) => {
              const updated = { ...step3, verifiedBy: e.target.value }
              setStep3(updated)
              void save(3, updated)
            }}
          />
          <input
            placeholder="Signature"
            value={step3.signature}
            onChange={(e) => {
              const updated = { ...step3, signature: e.target.value }
              setStep3(updated)
              void save(3, updated)
            }}
          />
          <button onClick={handleFinalSubmit}>Submit Report</button>
        </div>
      )}
    </div>
  )
}
