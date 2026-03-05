export default function PatientForm({ formData, onChange, onSubmit, submitting }) {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 rounded-xl bg-white p-5 shadow-lg md:grid-cols-2">
      <input
        name="first_name"
        value={formData.first_name}
        onChange={onChange}
        placeholder="First Name"
        className="rounded-xl border border-sky-200 p-3 outline-none transition-all focus:border-sky-500"
        required
      />
      <input
        name="last_name"
        value={formData.last_name}
        onChange={onChange}
        placeholder="Last Name"
        className="rounded-xl border border-sky-200 p-3 outline-none transition-all focus:border-sky-500"
        required
      />
      <input
        name="gender"
        value={formData.gender}
        onChange={onChange}
        placeholder="Gender"
        className="rounded-xl border border-sky-200 p-3 outline-none transition-all focus:border-sky-500"
      />
      <input
        name="phone_number"
        value={formData.phone_number}
        onChange={onChange}
        placeholder="Phone"
        className="rounded-xl border border-sky-200 p-3 outline-none transition-all focus:border-sky-500"
        required
      />
      <input
        name="email"
        value={formData.email}
        onChange={onChange}
        placeholder="Email"
        type="email"
        className="rounded-xl border border-sky-200 p-3 outline-none transition-all focus:border-sky-500"
      />
      <input
        name="blood_group"
        value={formData.blood_group}
        onChange={onChange}
        placeholder="Blood Group"
        className="rounded-xl border border-sky-200 p-3 outline-none transition-all focus:border-sky-500"
      />
      <input
        name="address"
        value={formData.address}
        onChange={onChange}
        placeholder="Address"
        className="rounded-xl border border-sky-200 p-3 outline-none transition-all focus:border-sky-500 md:col-span-2"
      />
      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70 md:col-span-2"
      >
        {submitting ? "Adding..." : "Add Patient"}
      </button>
    </form>
  );
}
