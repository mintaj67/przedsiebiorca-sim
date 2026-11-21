export function AchievementsScreen({
  onBack,
  fullPage = false,
}: {
  onBack?: () => void;
  fullPage?: boolean;
}) {
  const content = (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Osiągnięcia</h1>
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm text-stone-500 hover:text-stone-900"
          >
            ← Powrót
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 text-center text-stone-500 border border-stone-200">
        <p>System osiągnięć jest w przygotowaniu.</p>
        <p className="text-sm mt-2">Wróć tu, gdy Twoja firma stanie się legendą.</p>
      </div>
    </>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-stone-100 p-6 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
          {content}
        </div>
      </div>
    );
  }

  return <div className="p-2">{content}</div>;
}