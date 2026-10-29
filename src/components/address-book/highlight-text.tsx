export function HighlightText({ value, keyword }: { value: string; keyword: string }) {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) return value;
  const index = value.toLowerCase().indexOf(normalizedKeyword.toLowerCase());
  if (index < 0) return value;
  return (
    <>
      {value.slice(0, index)}
      <mark className="bg-transparent font-bold text-blue-600">
        {value.slice(index, index + normalizedKeyword.length)}
      </mark>
      {value.slice(index + normalizedKeyword.length)}
    </>
  );
}
