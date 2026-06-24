import { Component, OnDestroy, OnInit } from "@angular/core"
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms"
import { NgIf } from "@angular/common"
import { FormPersistService } from "form-persist/angular"

@Component({
  selector: "app-vaccine-form",
  standalone: true,
  imports: [ReactiveFormsModule, NgIf],
  template: `
    <div>
      <div *ngIf="hasSavedData" class="restore-banner">
        <p>You have saved progress from a previous session.</p>
        <button (click)="onRestore()">Continue</button>
        <button (click)="onStartFresh()">Start fresh</button>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <h2>Vaccine Arrival Report</h2>

        <input formControlName="facilityCode" placeholder="Facility Code" />
        <input formControlName="arrivalDate" type="date" />
        <input formControlName="batchNumber" placeholder="Batch Number" />
        <input formControlName="quantity" type="number" placeholder="Quantity" />

        <button type="submit" [disabled]="form.invalid">Submit</button>
      </form>
    </div>
  `,
})
export class VaccineFormComponent implements OnInit, OnDestroy {
  form: FormGroup
  hasSavedData = false

  constructor(
    private fb: FormBuilder,
    private formPersist: FormPersistService,
  ) {
    this.form = this.fb.group({
      facilityCode: ["", Validators.required],
      arrivalDate: ["", Validators.required],
      batchNumber: ["", Validators.required],
      quantity: [0, [Validators.required, Validators.min(1)]],
    })
  }

  async ngOnInit() {
    await this.formPersist.init({
      key: "vaccine-arrival-angular",
      steps: 1,
      ttl: "24h",
      clearOnSubmit: true,
      onClear: (reason) => {
        if (reason === "expired") {
          alert("Your saved form data has expired.")
        }
      },
    })

    this.hasSavedData = await this.formPersist.hasData()

    // Auto-save on every form change
    this.form.valueChanges.subscribe((value: Record<string, unknown>) => {
      void this.formPersist.saveAll(value)
    })
  }

  async onRestore() {
    const saved = await this.formPersist.restore()
    if (saved?.steps[0]) {
      this.form.patchValue(saved.steps[0].data as Record<string, unknown>)
      this.hasSavedData = false
    }
  }

  async onStartFresh() {
    await this.formPersist.reset()
    this.form.reset()
    this.hasSavedData = false
  }

  async onSubmit() {
    if (this.form.invalid) return
    await fetch("/api/vaccine-arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.form.value),
    })
    await this.formPersist.clear("submit")
    this.form.reset()
    alert("Report submitted!")
  }

  ngOnDestroy() {
    this.formPersist.destroy()
  }
}
