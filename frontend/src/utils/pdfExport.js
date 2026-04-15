/**
 * PDF export utilities for patient summaries
 */

export async function generatePatientPDF(patient, visits, timeline) {
  // Dynamically import html2pdf to avoid breaking the build
  const html2pdf = (await import("html2pdf.js")).default;

  // Format dates
  const dateFormatter = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Calculate age
  const calculateAge = (dob) => {
    if (!dob) return "N/A";
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Build HTML for PDF
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <!-- Header -->
      <div style="border-bottom: 3px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #0f766e;">PATIENT SUMMARY REPORT</h1>
        <p style="margin: 5px 0 0 0; color: #666;">Generated on ${new Date().toLocaleString()}</p>
      </div>

      <!-- Patient Information Section -->
      <div style="margin-bottom: 25px;">
        <h2 style="color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 8px;">Patient Information</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tr>
            <td style="padding: 8px; width: 50%; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Name:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${patient.first_name} ${patient.last_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Patient ID:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${patient.patient_id || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Age:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${calculateAge(patient.date_of_birth)} years</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Gender:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${patient.gender || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Date of Birth:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${dateFormatter(patient.date_of_birth)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Blood Group:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${patient.blood_group || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Phone:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${patient.phone_number || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Email:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${patient.email || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Address:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${patient.address || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Registration Date:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${dateFormatter(patient.registration_date)}</td>
          </tr>
        </table>
      </div>

      <!-- Visit History Section -->
      <div style="margin-bottom: 25px;">
        <h2 style="color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 8px;">Visit History (${visits?.length || 0} visits)</h2>
        ${
          visits && visits.length > 0
            ? `
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #0f766e; color: white;">
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Date</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Doctor</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Symptoms</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Medications</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              ${visits
                .map(
                  (visit, idx) => `
                <tr style="background-color: ${idx % 2 === 0 ? "#f0f9f8" : "#fff"};">
                  <td style="padding: 8px; border: 1px solid #e0f2f1;">${dateFormatter(visit.visit_date)}</td>
                  <td style="padding: 8px; border: 1px solid #e0f2f1;">${visit.doctor_name || "N/A"}</td>
                  <td style="padding: 8px; border: 1px solid #e0f2f1;">${visit.symptoms || "N/A"}</td>
                  <td style="padding: 8px; border: 1px solid #e0f2f1;">${visit.medications || "N/A"}</td>
                  <td style="padding: 8px; border: 1px solid #e0f2f1;">${dateFormatter(visit.follow_up_date)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
            : '<p style="color: #666; margin-top: 10px;">No visits recorded yet.</p>'
        }
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #ccc; padding-top: 15px; margin-top: 30px; color: #666; font-size: 12px;">
        <p style="margin: 0;">This report is for medical office record keeping only.</p>
        <p style="margin: 5px 0 0 0;">© Hospital Patient Management System</p>
      </div>
    </div>
  `;

  const options = {
    margin: [10, 10],
    filename: `patient-${patient.patient_id}-${Date.now()}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  html2pdf().set(options).from(htmlContent).save();
}
