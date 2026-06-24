/**
 * @jest-environment jsdom
 */
import React, { act } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { useFormPersist } from "../../src/adapters/react/useFormPersist"
import { clearAllForms } from "../../src/globals"
import { MemoryDriver } from "../../src/storage/MemoryDriver"
import type { FormPersistConfig } from "../../src/types"

function makeConfig(overrides: Partial<FormPersistConfig> = {}): FormPersistConfig {
  return {
    key: "test-form",
    ttl: "24h",
    storage: new MemoryDriver(),
    ...overrides,
  }
}

// ── minimal test component ────────────────────────────────────────────────────

interface Props {
  config: FormPersistConfig
  onMount?: (api: ReturnType<typeof useFormPersist>) => void
}

function TestForm({ config, onMount }: Props) {
  const api = useFormPersist(config)

  // Expose the API for test assertions via onMount
  React.useEffect(() => {
    onMount?.(api)
  })

  return (
    <div>
      <span data-testid="hasData">{String(api.hasData)}</span>
      <span data-testid="currentStep">{api.currentStep}</span>
      <span data-testid="isRestored">{String(api.isRestored)}</span>
      <button
        data-testid="saveBtn"
        onClick={() => api.saveAll({ field: "test-value" })}
      >
        Save
      </button>
      <button data-testid="restoreBtn" onClick={() => api.restore()}>
        Restore
      </button>
      <button data-testid="clearBtn" onClick={() => api.clear("manual")}>
        Clear
      </button>
      <button data-testid="resetBtn" onClick={() => api.reset()}>
        Reset
      </button>
    </div>
  )
}

// ── initial state ────────────────────────────────────────────────────────────

describe("useFormPersist — initial state", () => {
  it("renders with hasData=false when storage is empty", async () => {
    render(<TestForm config={makeConfig()} />)
    await waitFor(() => {
      expect(screen.getByTestId("hasData").textContent).toBe("false")
    })
  })

  it("currentStep starts at 0", async () => {
    render(<TestForm config={makeConfig()} />)
    await waitFor(() => {
      expect(screen.getByTestId("currentStep").textContent).toBe("0")
    })
  })
})

// ── saveAll / hasData ─────────────────────────────────────────────────────────

describe("useFormPersist — saveAll", () => {
  it("sets hasData to true after saving", async () => {
    render(<TestForm config={makeConfig()} />)

    await act(async () => {
      screen.getByTestId("saveBtn").click()
    })

    await waitFor(() => {
      expect(screen.getByTestId("hasData").textContent).toBe("true")
    })
  })
})

// ── clear ─────────────────────────────────────────────────────────────────────

describe("useFormPersist — clear", () => {
  it("sets hasData to false after clearing", async () => {
    render(<TestForm config={makeConfig()} />)

    await act(async () => {
      screen.getByTestId("saveBtn").click()
    })
    await act(async () => {
      screen.getByTestId("clearBtn").click()
    })

    await waitFor(() => {
      expect(screen.getByTestId("hasData").textContent).toBe("false")
    })
  })
})

// ── reset ─────────────────────────────────────────────────────────────────────

describe("useFormPersist — reset", () => {
  it("sets hasData to false and currentStep to 0 after reset", async () => {
    render(<TestForm config={makeConfig({ steps: 3 })} />)

    await act(async () => {
      screen.getByTestId("saveBtn").click()
    })
    await act(async () => {
      screen.getByTestId("resetBtn").click()
    })

    await waitFor(() => {
      expect(screen.getByTestId("hasData").textContent).toBe("false")
      expect(screen.getByTestId("currentStep").textContent).toBe("0")
    })
  })
})

// ── restore ───────────────────────────────────────────────────────────────────

describe("useFormPersist — restore", () => {
  it("sets isRestored to true after restoring saved data", async () => {
    const driver = new MemoryDriver()
    const config = makeConfig({ storage: driver })

    // Save data first
    const { unmount } = render(<TestForm config={config} />)
    await act(async () => {
      screen.getByTestId("saveBtn").click()
    })
    unmount()

    // Remount and restore
    render(<TestForm config={config} />)
    await act(async () => {
      screen.getByTestId("restoreBtn").click()
    })

    await waitFor(() => {
      expect(screen.getByTestId("isRestored").textContent).toBe("true")
    })
  })
})

// ── callbacks ─────────────────────────────────────────────────────────────────

describe("useFormPersist — callbacks", () => {
  it("calls onClear when clear is triggered", async () => {
    const onClear = jest.fn()
    render(<TestForm config={makeConfig({ onClear })} />)

    await act(async () => {
      screen.getByTestId("saveBtn").click()
    })
    await act(async () => {
      screen.getByTestId("clearBtn").click()
    })

    await waitFor(() => {
      expect(onClear).toHaveBeenCalledWith("manual")
    })
  })
})

// ── destroy on unmount ────────────────────────────────────────────────────────

describe("useFormPersist — cleanup", () => {
  it("does not throw when component unmounts", async () => {
    const { unmount } = render(<TestForm config={makeConfig()} />)
    expect(() => unmount()).not.toThrow()
  })
})

// ── mount with existing data (covers hasData=true branch in useEffect) ────────

describe("useFormPersist — mount with existing data", () => {
  it("loads currentStep when data already exists", async () => {
    const driver = new MemoryDriver()
    const { FormPersist } = await import("../../src/core/FormPersist")
    const seed = new FormPersist({ key: "test-form", ttl: "24h", storage: driver, steps: 3 })
    await seed.completeStep(0, { a: 1 }) // advances to step 1
    seed.destroy()

    render(<TestForm config={makeConfig({ storage: driver, steps: 3 })} />)

    await waitFor(() => {
      expect(screen.getByTestId("currentStep").textContent).toBe("1")
      expect(screen.getByTestId("hasData").textContent).toBe("true")
    })
  })
})

// ── save (step-indexed) ───────────────────────────────────────────────────────

describe("useFormPersist — save", () => {
  it("sets hasData to true and updates currentStep", async () => {
    let apiRef: ReturnType<typeof useFormPersist> | null = null

    render(
      <TestForm
        config={makeConfig({ steps: 3 })}
        onMount={(api) => {
          apiRef = api
        }}
      />
    )

    await waitFor(() => expect(apiRef).not.toBeNull())

    await act(async () => {
      await apiRef!.save(1, { data: "step-1" })
    })

    await waitFor(() => {
      expect(screen.getByTestId("hasData").textContent).toBe("true")
      expect(screen.getByTestId("currentStep").textContent).toBe("1")
    })
  })
})

// ── completeStep ──────────────────────────────────────────────────────────────

describe("useFormPersist — completeStep", () => {
  it("advances currentStep and sets hasData to true", async () => {
    let apiRef: ReturnType<typeof useFormPersist> | null = null

    render(
      <TestForm
        config={makeConfig({ steps: 3 })}
        onMount={(api) => {
          apiRef = api
        }}
      />
    )

    await waitFor(() => expect(apiRef).not.toBeNull())

    await act(async () => {
      await apiRef!.completeStep(0, { data: "step-0" })
    })

    await waitFor(() => {
      expect(screen.getByTestId("hasData").textContent).toBe("true")
      expect(screen.getByTestId("currentStep").textContent).toBe("1")
    })
  })
})

// ── onExpire callback ─────────────────────────────────────────────────────────

async function seedExpiredData(driver: MemoryDriver): Promise<void> {
  const { FormPersist } = await import("../../src/core/FormPersist")
  // compress: false so the stored value is plain JSON we can easily manipulate
  const seeder = new FormPersist({ key: "test-form", ttl: "24h", storage: driver, compress: false })
  await seeder.saveAll({ x: 1 })
  seeder.destroy()

  const raw = await driver.get("form-persist:test-form")
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    parsed.expiresAt = Date.now() - 1000
    await driver.set("form-persist:test-form", JSON.stringify(parsed))
  }
}

describe("useFormPersist — onExpire callback", () => {
  it("calls onExpire when restore encounters expired data", async () => {
    const driver = new MemoryDriver()
    const onExpire = jest.fn()
    await seedExpiredData(driver)

    render(<TestForm config={makeConfig({ storage: driver, onExpire, compress: false })} />)

    await act(async () => {
      screen.getByTestId("restoreBtn").click()
    })

    await waitFor(() => {
      expect(onExpire).toHaveBeenCalled()
    })
  })

  it("does not throw when onExpire is not provided and data is expired", async () => {
    const driver = new MemoryDriver()
    await seedExpiredData(driver)

    render(<TestForm config={makeConfig({ storage: driver, compress: false })} />)

    await expect(
      act(async () => {
        screen.getByTestId("restoreBtn").click()
      })
    ).resolves.not.toThrow()
  })
})

// ── onError callback ──────────────────────────────────────────────────────────

describe("useFormPersist — onError callback", () => {
  it("calls onError when storage throws during save", async () => {
    const onError = jest.fn()
    const brokenDriver = new MemoryDriver()
    jest.spyOn(brokenDriver, "set").mockRejectedValue(new Error("disk full"))

    let apiRef: ReturnType<typeof useFormPersist> | null = null
    render(
      <TestForm
        config={makeConfig({ storage: brokenDriver, onError })}
        onMount={(api) => { apiRef = api }}
      />
    )

    await waitFor(() => expect(apiRef).not.toBeNull())

    await act(async () => {
      await apiRef!.saveAll({ field: "value" })
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  it("does not throw when onError is not provided and storage fails", async () => {
    const brokenDriver = new MemoryDriver()
    jest.spyOn(brokenDriver, "set").mockRejectedValue(new Error("disk full"))

    let apiRef: ReturnType<typeof useFormPersist> | null = null
    render(
      <TestForm
        config={makeConfig({ storage: brokenDriver })}
        onMount={(api) => { apiRef = api }}
      />
    )

    await waitFor(() => expect(apiRef).not.toBeNull())

    await expect(
      act(async () => {
        await apiRef!.saveAll({ field: "value" })
      })
    ).resolves.not.toThrow()
  })
})

// ── onSave callback ───────────────────────────────────────────────────────────

describe("useFormPersist — onSave callback", () => {
  it("calls onSave after saveAll", async () => {
    const onSave = jest.fn()
    render(<TestForm config={makeConfig({ onSave })} />)

    await act(async () => {
      screen.getByTestId("saveBtn").click()
    })

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
    })
  })
})

// ── onRestore callback ────────────────────────────────────────────────────────

describe("useFormPersist — onRestore callback", () => {
  it("calls onRestore when restore returns data", async () => {
    const { FormPersist } = await import("../../src/core/FormPersist")
    const driver = new MemoryDriver()
    const onRestore = jest.fn()

    const seeder = new FormPersist({ key: "test-form", ttl: "24h", storage: driver })
    await seeder.saveAll({ field: "value" })
    seeder.destroy()

    render(<TestForm config={makeConfig({ storage: driver, onRestore })} />)

    await act(async () => {
      screen.getByTestId("restoreBtn").click()
    })

    await waitFor(() => {
      expect(onRestore).toHaveBeenCalled()
    })
  })
})

// ── restore returns null ──────────────────────────────────────────────────────

describe("useFormPersist — restore with no data", () => {
  it("keeps isRestored false when restore returns null", async () => {
    render(<TestForm config={makeConfig()} />)

    await act(async () => {
      screen.getByTestId("restoreBtn").click()
    })

    await waitFor(() => {
      expect(screen.getByTestId("isRestored").textContent).toBe("false")
    })
  })
})

// ── setStep ───────────────────────────────────────────────────────────────────

describe("useFormPersist — setStep", () => {
  it("updates currentStep via setStep", async () => {
    let apiRef: ReturnType<typeof useFormPersist> | null = null

    render(
      <TestForm
        config={makeConfig({ steps: 5 })}
        onMount={(api) => { apiRef = api }}
      />
    )

    await waitFor(() => expect(apiRef).not.toBeNull())

    await act(async () => {
      apiRef!.setStep(3)
    })

    await waitFor(() => {
      expect(screen.getByTestId("currentStep").textContent).toBe("3")
    })
  })
})

// ── clear with default reason ─────────────────────────────────────────────────

describe("useFormPersist — clear default reason", () => {
  it("defaults to 'manual' reason when clear is called without argument", async () => {
    const onClear = jest.fn()
    let apiRef: ReturnType<typeof useFormPersist> | null = null

    render(
      <TestForm
        config={makeConfig({ onClear })}
        onMount={(api) => { apiRef = api }}
      />
    )

    await waitFor(() => expect(apiRef).not.toBeNull())

    await act(async () => {
      await apiRef!.saveAll({ x: 1 })
    })
    await act(async () => {
      await apiRef!.clear()
    })

    await waitFor(() => {
      expect(onClear).toHaveBeenCalledWith("manual")
    })
  })
})

// ── globals.ts window-defined branch (jsdom has window) ──────────────────────

describe("globals — browser environment (jsdom)", () => {
  it("clearAllForms without explicit storage uses LocalStorageDriver in browser", async () => {
    // In jsdom, typeof window !== 'undefined' → defaultDriver creates LocalStorageDriver.
    // This covers the branch at globals.ts:10 that is unreachable in Node tests.
    await expect(clearAllForms()).resolves.toBeUndefined()
  })
})

// ── LocalStorageDriver lines 24-25 (window undefined branch) ─────────────────
// These lines are unreachable from LocalStorageDriver.test.ts (jsdom environment).
// In the react test file we have jsdom, but we can test the Node path via direct
// driver construction after temporarily removing window from scope — or by
// exploiting that LocalStorageDriver gracefully falls back when _isAvailable() is false.
// The Node-environment path is covered by the globals.test.ts describe below
// which imports LocalStorageDriver in a Node (non-jsdom) test file.
// This comment block documents the coverage strategy rather than duplicating tests.
