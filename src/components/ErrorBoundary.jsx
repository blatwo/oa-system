import { Component } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

/**
 * React Error Boundary — catches render errors and reports to backend logs.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Send to backend logs
    if (window.__sendError) {
      window.__sendError(
        error.message || String(error),
        (error.stack || '') + '\n\nComponent Stack:\n' + (info.componentStack || ''),
        this.props.name || 'Layout'
      );
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Paper sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
            <Typography variant="h6" gutterBottom>页面渲染出错</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, wordBreak: 'break-all' }}>
              {this.state.error?.message || '未知错误'}
            </Typography>
            <Button variant="contained" onClick={this.handleReset}>
              重试
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}
