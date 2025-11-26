import React, {useEffect, useState} from 'react';
import api from '../api';
import { useParams } from 'react-router-dom';

export default function PublicView(){
  const { token } = useParams();
  const [entry,setEntry] = useState(null);
  useEffect(()=> {
    (async ()=> {
      try {
        const r = await api.get(`/public/entry/${token}`);
        setEntry(r.data.entry);
      } catch (err) {
        setEntry(null);
      }
    })();
  },[token]);
  if (entry === null) return <div className="p-6">Loading...</div>;
  if (!entry) return <div className="p-6">Not found</div>;
  return (
    <div className="p-6 max-w-3xl mx-auto bg-white rounded shadow">
      <h1 className="text-2xl font-bold">{entry.word} <span className="text-sm text-gray-500">({entry.language})</span></h1>
      <p className="mt-2">{entry.meaning}</p>
      {entry.sample_sentences && JSON.parse(entry.sample_sentences).map((s,i)=><p key={i} className="italic mt-1">- {s}</p>)}
      {entry.audio_filename && <audio controls className="mt-3" src={`${import.meta.env.VITE_API_BASE || 'http://localhost:4000'}/uploads/${entry.audio_filename}`} />}
    </div>
  );
}
