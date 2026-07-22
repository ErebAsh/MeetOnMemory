import { Users, UserPlus, X } from "lucide-react";

const ParticipantsSection = ({
  participants,
  newParticipant,
  setNewParticipant,
  addParticipant,
  removeParticipant,
}) => {
  return (
    <div className="mb-6">
      <label className="block mb-3 font-semibold text-gray-700 flex items-center gap-2">
        <Users size={18} /> Invite Participants
      </label>
      <div className="grid md:grid-cols-2 gap-3 mb-3">
        <input
          type="text"
          value={newParticipant.name}
          onChange={(e) =>
            setNewParticipant({
              ...newParticipant,
              name: e.target.value,
            })
          }
          placeholder="Full Name"
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
        />
        <input
          type="email"
          value={newParticipant.email}
          onChange={(e) =>
            setNewParticipant({
              ...newParticipant,
              email: e.target.value,
            })
          }
          placeholder="Email Address"
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
        />
      </div>
      <button
        type="button"
        onClick={addParticipant}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
      >
        <UserPlus size={16} /> Add Participant
      </button>

      {participants.length > 0 && (
        <div className="mt-4 space-y-2">
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
            >
              <span className="text-sm">
                <strong>{p.name}</strong> - {p.email}
              </span>
              <button
                type="button"
                onClick={() => removeParticipant(p.id)}
                className="text-red-600 hover:text-red-800"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParticipantsSection;
