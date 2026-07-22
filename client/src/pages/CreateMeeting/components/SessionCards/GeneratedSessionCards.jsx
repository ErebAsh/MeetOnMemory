import { Tag, ExternalLink } from "lucide-react";

const GeneratedSessionCards = ({ generatedSessions }) => {
  if (generatedSessions.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold text-gray-900 mb-4">
        ✨ Generated Session Cards
      </h3>
      <div className="space-y-4">
        {generatedSessions.map((session, index) => (
          <div
            key={index}
            className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-lg font-bold text-gray-900">
                  {session.sessionTitle}
                </h4>
                <p className="text-sm text-gray-600">{session.eventName}</p>
              </div>
              <span className="px-3 py-1 bg-purple-600 text-white text-xs rounded-full">
                Session
              </span>
            </div>

            {session.speaker && (
              <div className="mb-3 p-3 bg-white rounded-lg">
                <p className="text-sm font-semibold text-gray-900">
                  {session.speaker}
                </p>
                {session.speakerTitle && (
                  <p className="text-xs text-gray-600">
                    {session.speakerTitle}
                  </p>
                )}
              </div>
            )}

            <p className="text-sm text-gray-700 mb-3">
              {session.summary || "AI-generated summary will appear here..."}
            </p>

            {session.keywords && session.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {session.keywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1"
                  >
                    <Tag size={12} /> {keyword}
                  </span>
                ))}
              </div>
            )}

            {session.videoUrl && (
              <a
                href={session.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
              >
                <ExternalLink size={16} /> Watch Video
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeneratedSessionCards;
