import React, {useState} from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function Login(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const nav = useNavigate();
  async function submit(e){
    e.preventDefault();
    try {
      const r = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', r.data.token);
      nav('/');
    } catch (err) {
      alert(err?.response?.data?.error || 'Login failed');
    }
  }
  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl mb-4">Login</h2>
      <form onSubmit={submit} className="space-y-3">
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="border p-2 w-full rounded" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="border p-2 w-full rounded" />
        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded">Login</button>
      </form>
    </div>
  );
}
