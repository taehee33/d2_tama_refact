import React from "react";

function MemoryNotesPanel({ notes = [] }) {
  return (
    <div className="notebook-memory-notes">
      {notes.map((note) => (
        <article key={note.id} className="notebook-memory-note">
          <strong>{note.title}</strong>
          <p>{note.body}</p>
        </article>
      ))}
    </div>
  );
}

export default MemoryNotesPanel;
