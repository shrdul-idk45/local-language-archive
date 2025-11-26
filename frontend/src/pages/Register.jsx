import React, {useState} from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function Register(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [name,setName]=useState('');
  const nav = useNavigate();
  async function submit(e){
    e.preventDefault();
    try {
      const r = await api.post('/auth/register', { email, password, display_name: name });
      localStorage.setItem('token', r.data.token);
      nav('/');
    } catch (err) {
      alert(err?.response?.data?.error || 'Register failed');
    }
  }
  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl mb-4">Register</h2>
      <form onSubmit={submit} className="space-y-3">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Display name" className="border p-2 w-full rounded" />
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="border p-2 w-full rounded" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="border p-2 w-full rounded" />
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Register</button>
      </form>
    </div>
  );
}
