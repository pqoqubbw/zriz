import { apiDoc, defaultOf } from "@/lib/api";

export const ApiTable = async ({
  file,
  name,
}: {
  file: string;
  name: string;
}) => {
  const doc = await apiDoc(file, name);
  return (
    <div className="api">
      <table data-api={name}>
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          {doc.entries.map((entry) => (
            <tr key={entry.name}>
              <td>
                <code>{entry.name}</code>
                <p>{entry.description}</p>
              </td>
              <td>
                <code>{entry.type}</code>
              </td>
              <td>
                {defaultOf(entry) === undefined ? null : (
                  <code>{defaultOf(entry)}</code>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
