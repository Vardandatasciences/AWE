import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { format, parse } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Select,
  MenuItem,
  TextField
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
 
const Diary = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const role_id = localStorage.getItem('role_id');
  const actor_id = localStorage.getItem('actor_id')
  console.log("User Role ID:", role_id);
  console.log("User User ID:", actor_id)

 
  const emptyEntry = {
    date: new Date(),
    start_time: null,
    end_time: null,
    task: '',
    remarks: ''
  };
  useEffect(() => {
    let actorId = localStorage.getItem('actor_id');

    if (!actorId) {
        console.warn("⚠️ No actor ID found in localStorage, setting default...");
        localStorage.setItem('actor_id', 'Khairu'); // Set a default for testing
        actorId = 'Khairu';
    }

    console.log("🚀 Actor ID found:", actorId);
    fetchWIPTasks();
}, []);



  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await fetchWIPTasks(); // Use the existing function
        
        // Then fetch entries
        const actorId = localStorage.getItem('actor_id');
        const entriesResponse = await axios.get('http://localhost:5000/diary/entries', {
          params: { actor_id: actorId }
        });
        console.log(entriesResponse)
        
        const formattedEntries = entriesResponse.data.map(entry => ({
          ...entry,
          date: entry.date ? new Date(entry.date) : null,
          start_time: entry.start_time ? parse(entry.start_time, 'HH:mm', new Date()) : null,
          end_time: entry.end_time ? parse(entry.end_time, 'HH:mm', new Date()) : null
        }));
        
        setEntries(formattedEntries);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);

  
 
  const handleAddEntry = async () => {
    const token = localStorage.getItem('token');
    const actorId = localStorage.getItem('actor_id');

    if (!token || !actorId) {
        console.error("🔴 No authentication token or actor_id found in localStorage");
        alert("Session expired. Please log in again.");
        navigate('/login');
        return;
    }

    console.log('Fetching WIP tasks before adding new entry...');
    
    try {
        // Call fetchWIPTasks first to ensure tasks are loaded
        await fetchWIPTasks();
        
        // Now create the new entry
        const newEntry = {
            id: Date.now(),
            date: new Date(),
            start_time: null,
            end_time: null,
            task: tasks.length > 0 ? tasks[0].task_id : '',
            remarks: ''
        };

        setEntries(prev => [...prev, newEntry]);
    } catch (error) {
        console.error('🔴 Error adding entry:', error);
        alert("Failed to add entry. Please try again.");
    }
};





 
  const handleSaveEntries = async () => {
    try {
      const token = localStorage.getItem('token');
      const actorId = localStorage.getItem('actor_id');
      const formattedEntries = entries.map(entry => ({
        ...entry,
        date: entry.date ? format(entry.date, 'yyyy-MM-dd') : null,
        start_time: entry.start_time ? format(entry.start_time, 'HH:mm') : null,
        end_time: entry.end_time ? format(entry.end_time, 'HH:mm') : null
      }));
      
      await axios.post('http://localhost:5000/diary/save',
        {
          entries: formattedEntries,
          actor_id: actorId
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Refresh entries after save
      const response = await axios.get('http://localhost:5000/diary/entries', {
        params: { actor_id: actorId },
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const updatedEntries = response.data.map(entry => ({
        ...entry,
        date: entry.date ? new Date(entry.date) : null,
        start_time: entry.start_time ? parse(entry.start_time, 'HH:mm', new Date()) : null,
        end_time: entry.end_time ? parse(entry.end_time, 'HH:mm', new Date()) : null
      }));
      
      setEntries(updatedEntries);
    } catch (error) {
      console.error('Error saving entries:', error);
    }
  };
 
  const handleDeleteConfirmation = (entry) => {
    setSelectedEntry(entry);
    setDeleteDialogOpen(true);
  };
 
  const handleDelete = async () => {
    if (selectedEntry) {
      try {
        if (selectedEntry.id > 0) {
          const actorId = localStorage.getItem('actor_id');
          await axios.delete(`http://localhost:5000/diary/entries/${selectedEntry.id}?actor_id=${actorId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
        }
        setEntries(entries.filter(entry => entry.id !== selectedEntry.id));
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
    setDeleteDialogOpen(false);
  };
 
  const fetchWIPTasks = async () => {
    try {
        const token = localStorage.getItem('token');
        const actorId = localStorage.getItem('actor_id');

        console.log("📌 Making API request to /diary/wip-tasks with actor_id:", actorId);
        
        const response = await axios.get(`http://localhost:5000/diary/wip-tasks`, {
            params: { actor_id: actorId },
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('🟢 API response status:', response.status);
        console.log('🟢 WIP tasks raw response:', response.data);
        
        // Remove fallback data, we want to fix the real issue
        const tasksArray = Array.isArray(response.data) ? response.data : [response.data];
        
        if (tasksArray.length === 0) {
            console.log('⚠️ No tasks returned from API. Check backend query.');
        }
        
        setTasks(tasksArray);
        return tasksArray;
    } catch (error) {
        console.error('🔴 Error fetching WIP tasks:', error);
        return [];
    }
};
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <Button variant="contained" color="primary" onClick={handleAddEntry}>
            Add Diary Entry
          </Button>
          <Button variant="contained" color="success" onClick={handleSaveEntries}>
            Save Entries
          </Button>
        </div>
 
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell style={{ width: '3%' }}>Serial No.</TableCell>
                <TableCell style={{ width: '15%' }}>Date</TableCell>
                <TableCell style={{ width: '14%' }}>Start Time</TableCell>
                <TableCell style={{ width: '14%' }}>End Time</TableCell>
                <TableCell style={{ width: '25%' }}>Task</TableCell>
                <TableCell style={{ width: '35%' }}>Remarks</TableCell>
                <TableCell style={{ width: '5%' }}>Remove</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
  {entries.map((entry, index) => (
    <TableRow key={entry.id}>
      <TableCell style={{ width: '3%' }}>{index + 1}</TableCell>
      <TableCell style={{ width: '15%' }}>
        <DatePicker
          value={entry.date}
          onChange={(newDate) => {
            const updatedEntries = [...entries];
            updatedEntries[index].date = newDate;
            setEntries(updatedEntries);
          }}
          slotProps={{
            textField: { size: "small", style: { width: '100%' } }
          }}
        />
      </TableCell>
      <TableCell style={{ width: '14%' }}>
        <TimePicker
          value={entry.start_time}
          onChange={(newTime) => {
            const updatedEntries = [...entries];
            updatedEntries[index].start_time = newTime;
            setEntries(updatedEntries);
          }}
          slotProps={{
            textField: { size: "small", style: { width: '100%' } }
          }}
        />
      </TableCell>
      <TableCell style={{ width: '14%' }}>
        <TimePicker
          value={entry.end_time}
          onChange={(newTime) => {
            const updatedEntries = [...entries];
            updatedEntries[index].end_time = newTime;
            setEntries(updatedEntries);
          }}
          slotProps={{
            textField: { size: "small", style: { width: '100%' } }
          }}
        />
      </TableCell>
      <TableCell style={{ width: '40%' }}>
      <Select
    value={entry.task || ''}
    onChange={(e) => {
        const updatedEntries = [...entries];
        updatedEntries[index].task = e.target.value;
        setEntries(updatedEntries);
    }}
    fullWidth
    size="small"
    displayEmpty
>
    <MenuItem value="" disabled>Select a task</MenuItem>
    {entry.task && !tasks.some(task => task.task_id === entry.task) && (
        <MenuItem value={entry.task}>ID: {entry.task}</MenuItem>
    )}
    {tasks && tasks.length > 0 ? (
        tasks.map((task) => (
            <MenuItem key={task.task_id} value={task.task_id}>
                {task.task_name}
            </MenuItem>
        ))
    ) : (
        <MenuItem disabled>No WIP tasks available</MenuItem>
    )}
</Select>


</TableCell>



      <TableCell style={{ width: '35%' }}>
        <TextField
          value={entry.remarks || ''}
          onChange={(e) => {
            const updatedEntries = [...entries];
            updatedEntries[index].remarks = e.target.value;
            setEntries(updatedEntries);
          }}
          fullWidth
          size="small"
        />
      </TableCell>
      <TableCell style={{ width: '5%' }}>
        <IconButton onClick={() => handleDeleteConfirmation(entry)} color="error" size="small">
          <DeleteIcon />
        </IconButton>
      </TableCell>
    </TableRow>
  ))}
</TableBody>

          </Table>
        </TableContainer>
 
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete this diary entry?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDelete} color="error" autoFocus>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </LocalizationProvider>
  );
};
 
export default Diary;
 
 