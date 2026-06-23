const axios = require('axios');
(async ()=>{
  try{
    const res = await axios.post('http://127.0.0.1:3000/api/auth/register', {
      name: 'Admin User',
      email: 'admin@clooval.com',
      password: 'adminpass',
      phone: '+230000000',
      resident: 'Port Louis'
    });
    console.log('Created:', res.status, res.data);
  }catch(e){
    if (e.response) console.error('Error:', e.response.status, e.response.data);
    else console.error(e.message);
  }
})();
