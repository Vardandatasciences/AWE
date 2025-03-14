import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { format, parse } from 'date-fns';
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
 
  const emptyEntry = {
    date: new Date(),
    start_time: null,
    end_time: null,
    task: '',
    remarks: ''
  };
 
  useEffect(() => {
    const fetchData = async () => {
      try {
        const actorId = localStorage.getItem('actor_id'); // Get actor_id from localStorage

        // Fetch WIP tasks with actor_id
        const tasksResponse = await axios.get(`http://localhost:5000/diary/wip-tasks?actor_id=${actorId}`);
        if (tasksResponse.status === 200) {
          setTasks(tasksResponse.data);
        }

        // Fetch diary entries
        const entriesResponse = await axios.get('http://localhost:5000/diary/entries');
        const formattedEntries = entriesResponse.data.map(entry => ({
          ...entry,
          date: entry.date ? new Date(entry.date) : null,
          start_time: entry.start_time ? parse(entry.start_time, 'HH:mm', new Date()) : null,
          end_time: entry.end_time ? parse(entry.end_time, 'HH:mm', new Date()) : null
        }));
        setEntries(formattedEntries);
      } catch (error) {
        console.error('Error in fetchData:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
 
  const handleAddEntry = () => {
    setEntries(prev => [...prev, { ...emptyEntry, id: -Date.now() }]);
  };
 
  const handleSaveEntries = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('user_id');
      const formattedEntries = entries.map(entry => ({
        ...entry,
        date: entry.date ? format(entry.date, 'yyyy-MM-dd') : null,
        start_time: entry.start_time ? format(entry.start_time, 'HH:mm') : null,
        end_time: entry.end_time ? format(entry.end_time, 'HH:mm') : null
      }));
     
      await axios.post('http://localhost:5000/diary/save',
        {
          entries: formattedEntries,
          user_id: userId
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
        headers: { 'Authorization': `Bearer ${token}` },
        data: { user_id: userId }
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
          const userId = localStorage.getItem('user_id');
          await axios.delete(`http://localhost:5000/diary/entries/${selectedEntry.id}?user_id=${userId}`, {
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
      const userId = localStorage.getItem('user_id');
     
      if (!token || !userId) {
        throw new Error('No authentication token or user_id found');
      }
     
      console.log('Fetching WIP tasks...');
      const response = await axios.get(`http://localhost:5000/diary/wip-tasks?user_id=${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
     
      console.log('WIP tasks response:', response.data);
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching WIP tasks:', error);
      if (error.response) {
        console.error('Server response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
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
                        textField: {
                          size: "small",
                          style: { width: '100%' }
                        }
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
                        textField: {
                          size: "small",
                          style: { width: '100%' }
                        }
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
                        textField: {
                          size: "small",
                          style: { width: '100%' }
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell style={{ width: '25%' }}>
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
                      {tasks.map((task) => (
                        <MenuItem key={task.id} value={task.name}>
                          {task.name}
                        </MenuItem>
                      ))}
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
 
 