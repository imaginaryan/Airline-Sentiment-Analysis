import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import axios from "axios";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Color schemes
const SENTIMENT_COLORS = {
  positive: '#10B981',
  negative: '#EF4444', 
  neutral: '#6B7280'
};

const PIE_COLORS = ['#10B981', '#EF4444', '#6B7280'];

const Dashboard = () => {
  const [overview, setOverview] = useState(null);
  const [airlines, setAirlines] = useState([]);
  const [negativeReasons, setNegativeReasons] = useState([]);
  const [tweets, setTweets] = useState([]);
  const [selectedAirline, setSelectedAirline] = useState('');
  const [selectedSentiment, setSelectedSentiment] = useState('');
  const [loading, setLoading] = useState(true);
  const [airlinesList, setAirlinesList] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [overviewRes, airlinesRes, negativeRes, tweetsRes, airlinesListRes] = await Promise.all([
        axios.get(`${API}/sentiment/overview`),
        axios.get(`${API}/sentiment/airlines`),
        axios.get(`${API}/sentiment/negative-reasons`),
        axios.get(`${API}/sentiment/tweets?limit=20`),
        axios.get(`${API}/sentiment/airlines/list`)
      ]);
      
      setOverview(overviewRes.data);
      setAirlines(airlinesRes.data);
      setNegativeReasons(negativeRes.data);
      setTweets(tweetsRes.data);
      setAirlinesList(airlinesListRes.data.airlines);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredTweets = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAirline) params.append('airline', selectedAirline);
      if (selectedSentiment) params.append('sentiment', selectedSentiment);
      params.append('limit', '20');
      
      const response = await axios.get(`${API}/sentiment/tweets?${params}`);
      setTweets(response.data);
    } catch (error) {
      console.error('Error fetching filtered tweets:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedAirline || selectedSentiment) {
      fetchFilteredTweets();
    } else {
      fetchData();
    }
  }, [selectedAirline, selectedSentiment]);

  const pieData = overview ? [
    { name: 'Positive', value: overview.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Negative', value: overview.negative, color: SENTIMENT_COLORS.negative },
    { name: 'Neutral', value: overview.neutral, color: SENTIMENT_COLORS.neutral }
  ] : [];

  if (loading) {
    return (
      <div data-testid="loading-spinner" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading airline sentiment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard" className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                ✈️ Airline Sentiment Analytics
              </h1>
              <p className="text-gray-600 mt-1">
                Real-time sentiment analysis across major airlines
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Analyzed</p>
                <p data-testid="total-tweets" className="text-2xl font-bold text-blue-600">
                  {overview?.total_tweets?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div data-testid="positive-card" className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Positive Sentiment</p>
                <p className="text-2xl font-bold text-green-600">
                  {overview?.positive_percentage || 0}%
                </p>
                <p className="text-sm text-gray-500">
                  {overview?.positive?.toLocaleString() || 0} tweets
                </p>
              </div>
              <div className="text-3xl">😊</div>
            </div>
          </div>
          
          <div data-testid="negative-card" className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Negative Sentiment</p>
                <p className="text-2xl font-bold text-red-600">
                  {overview?.negative_percentage || 0}%
                </p>
                <p className="text-sm text-gray-500">
                  {overview?.negative?.toLocaleString() || 0} tweets
                </p>
              </div>
              <div className="text-3xl">😞</div>
            </div>
          </div>
          
          <div data-testid="neutral-card" className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-gray-500">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Neutral Sentiment</p>
                <p className="text-2xl font-bold text-gray-600">
                  {overview?.neutral_percentage || 0}%
                </p>
                <p className="text-sm text-gray-500">
                  {overview?.neutral?.toLocaleString() || 0} tweets
                </p>
              </div>
              <div className="text-3xl">😐</div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Sentiment Distribution Pie Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Overall Sentiment Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value.toLocaleString()} tweets`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Airlines Bar Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Airlines by Total Volume
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={airlines}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="airline" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip formatter={(value) => [`${value.toLocaleString()} tweets`, 'Total Tweets']} />
                <Bar dataKey="total_tweets" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Airlines Sentiment Breakdown */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sentiment Breakdown by Airline
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Airline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Tweets
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Positive
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Negative
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Neutral
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sentiment Score
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {airlines.map((airline) => (
                  <tr key={airline.airline} data-testid={`airline-row-${airline.airline.toLowerCase().replace(/\s+/g, '-')}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{airline.airline}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {airline.total_tweets.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      {airline.positive.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {airline.negative.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {airline.neutral.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        airline.sentiment_score > 0.1 
                          ? 'bg-green-100 text-green-800' 
                          : airline.sentiment_score < -0.1 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {airline.sentiment_score.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Negative Reasons */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top Negative Feedback Reasons
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={negativeReasons} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis 
                type="category" 
                dataKey="reason" 
                tick={{ fontSize: 12 }}
                width={120}
              />
              <Tooltip formatter={(value, name) => [`${value.toLocaleString()} complaints`, 'Count']} />
              <Bar dataKey="count" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Filters and Recent Tweets */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-0">
              Recent Tweets
            </h3>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                data-testid="airline-filter"
                value={selectedAirline}
                onChange={(e) => setSelectedAirline(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Airlines</option>
                {airlinesList.map((airline) => (
                  <option key={airline} value={airline}>
                    {airline}
                  </option>
                ))}
              </select>
              
              <select
                data-testid="sentiment-filter"
                value={selectedSentiment}
                onChange={(e) => setSelectedSentiment(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Sentiments</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="neutral">Neutral</option>
              </select>
              
              <button
                data-testid="clear-filters"
                onClick={() => {
                  setSelectedAirline('');
                  setSelectedSentiment('');
                }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
          
          {/* Tweets List */}
          <div data-testid="tweets-list" className="space-y-4 max-h-96 overflow-y-auto">
            {tweets.map((tweet) => (
              <div
                key={tweet.tweet_id}
                data-testid={`tweet-${tweet.tweet_id}`}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="font-medium text-gray-900">{tweet.airline}</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        tweet.sentiment === 'positive' 
                          ? 'bg-green-100 text-green-800'
                          : tweet.sentiment === 'negative'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tweet.sentiment}
                      </span>
                      {tweet.negative_reason && (
                        <span className="inline-flex px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                          {tweet.negative_reason}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 mb-2">{tweet.text}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>{tweet.created}</span>
                      {tweet.location && <span>📍 {tweet.location}</span>}
                      <span>Confidence: {(tweet.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;