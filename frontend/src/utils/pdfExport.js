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

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.45;">
      <div style="border-bottom: 3px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #0f766e;">PATIENT SUMMARY REPORT / रोगी सारांश रिपोर्ट</h1>
        <p style="margin: 5px 0 0 0; color: #666;">Generated on / तैयार किया गया: ${new Date().toLocaleString()}</p>
      </div>

      <div style="margin-bottom: 25px;">
        <h2 style="color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 8px;">Patient Information / रोगी जानकारी</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tr>
            <td style="padding: 8px; width: 50%; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Name / नाम:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${patient.first_name} ${patient.last_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Patient ID / रोगी ID:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${patient.patient_id || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Age / आयु:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${calculateAge(patient.date_of_birth)} years / वर्ष</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Gender / लिंग:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${patient.gender || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Date of Birth / जन्म तिथि:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${dateFormatter(patient.date_of_birth)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Blood Group / रक्त समूह:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${patient.blood_group || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Phone / फोन:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${patient.phone_number || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Email / ईमेल:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${patient.email || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;"><strong>Address / पता:</strong></td>
            <td style="padding: 8px; background-color: #f0f9f8; border: 1px solid #e0f2f1;">${patient.address || "N/A"}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background-color: #fff;"><strong>Registration Date / पंजीकरण तिथि:</strong></td>
            <td style="padding: 8px; background-color: #fff;">${dateFormatter(patient.registration_date)}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 25px;">
        <h2 style="color: #0f766e; border-bottom: 2px solid #0f766e; padding-bottom: 8px;">Visit History / मुलाकात इतिहास (${visits?.length || 0})</h2>
        ${
          visits && visits.length > 0
            ? `
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #0f766e; color: white;">
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Date / तारीख</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Doctor / डॉक्टर</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Symptoms / लक्षण</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Medications / दवाइयां</th>
                <th style="padding: 10px; text-align: left; border: 1px solid #0f766e;">Follow-up / अनुवर्ती</th>
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
            : '<p style="color: #666; margin-top: 10px;">No visits recorded yet. / अभी तक कोई मुलाकात दर्ज नहीं है।</p>'
        }
      </div>

      <div style="border-top: 1px solid #ccc; padding-top: 15px; margin-top: 30px; color: #666; font-size: 12px;">
        <p style="margin: 0;">This report is for medical office record keeping only. / यह रिपोर्ट केवल चिकित्सा कार्यालय रिकॉर्ड के लिए है।</p>
        <p style="margin: 5px 0 0 0;">© Hospital Patient Management System / © अस्पताल रोगी प्रबंधन प्रणाली</p>
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
