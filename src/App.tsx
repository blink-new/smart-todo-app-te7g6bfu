import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Zap, CheckCircle2, Clock, AlertCircle, Briefcase, Heart, Home, BookOpen, ShoppingCart, Settings, Trash2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

import { blink } from './blink/client'
import { toast } from 'react-hot-toast'

interface Todo {
  id: string
  title: string
  description: string
  category: 'work' | 'personal' | 'health' | 'home' | 'learning' | 'shopping' | 'other'
  priority: 'low' | 'medium' | 'high'
  completed: boolean
  created_at: string
  due_date?: string
  user_id: string
}

const categories = [
  { id: 'work', name: 'Work', icon: Briefcase, color: 'bg-blue-100 text-blue-800' },
  { id: 'personal', name: 'Personal', icon: Heart, color: 'bg-pink-100 text-pink-800' },
  { id: 'health', name: 'Health', icon: Heart, color: 'bg-green-100 text-green-800' },
  { id: 'home', name: 'Home', icon: Home, color: 'bg-yellow-100 text-yellow-800' },
  { id: 'learning', name: 'Learning', icon: BookOpen, color: 'bg-purple-100 text-purple-800' },
  { id: 'shopping', name: 'Shopping', icon: ShoppingCart, color: 'bg-orange-100 text-orange-800' },
  { id: 'other', name: 'Other', icon: Settings, color: 'bg-gray-100 text-gray-800' }
]

const priorities = [
  { id: 'low', name: 'Low', color: 'bg-green-100 text-green-800' },
  { id: 'medium', name: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'high', name: 'High', color: 'bg-red-100 text-red-800' }
]

function ensureArray<T>(response: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(response)) return response as T[]
  if (response && typeof response === 'object') {
    // @ts-expect-error index signature
    if (Array.isArray((response as any).data)) return (response as any).data as T[]
    // Try to find first array value property
    for (const value of Object.values(response as Record<string, unknown>)) {
      if (Array.isArray(value)) return value as T[]
    }
  }
  return fallback
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [newTodo, setNewTodo] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [isAddingTodo, setIsAddingTodo] = useState(false)

  // Auto-categorize function using AI
  const categorizeTodo = async (title: string, description: string) => {
    try {
      const { text } = await blink.ai.generateText({
        prompt: `Categorize this todo task into one of these categories: work, personal, health, home, learning, shopping, other.
        
        Task: "${title}"
        Description: "${description}"
        
        Consider these guidelines:
        - work: professional tasks, meetings, projects, deadlines
        - personal: hobbies, social activities, personal goals
        - health: exercise, medical appointments, wellness
        - home: chores, maintenance, home improvement
        - learning: education, skills, reading, courses
        - shopping: buying items, groceries, online purchases
        - other: anything that doesn't fit the above
        
        Respond with just the category name (lowercase).`,
        maxTokens: 50
      })

      const category = text.trim().toLowerCase()
      return categories.find(cat => cat.id === category) ? category : 'other'
    } catch (error) {
      console.error('Error categorizing todo:', error)
      return 'other'
    }
  }

  // Auto-prioritize function using AI
  const prioritizeTodo = async (title: string, description: string) => {
    try {
      const { text } = await blink.ai.generateText({
        prompt: `Determine the priority level for this todo task: low, medium, or high.
        
        Task: "${title}"
        Description: "${description}"
        
        Consider urgency, importance, and impact:
        - high: urgent deadlines, important meetings, critical tasks
        - medium: important but not urgent, moderate impact
        - low: nice to have, can be done later, minimal impact
        
        Respond with just the priority level (lowercase).`,
        maxTokens: 50
      })

      const priority = text.trim().toLowerCase()
      return priorities.find(p => p.id === priority) ? priority : 'medium'
    } catch (error) {
      console.error('Error prioritizing todo:', error)
      return 'medium'
    }
  }

  // Load todos from database
  const loadTodos = async () => {
    try {
      setIsLoading(true)
      const response = await blink.db.todos.list({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' }
      })
      const todoArray = ensureArray<Todo>(response)
      // Filter out invalid records missing id
      const validArray = todoArray.filter(t => typeof t.id === 'string' && t.id.trim() !== '')
      // Remove potential duplicates by id
      const uniqueArray = Array.from(new Map(validArray.map((t) => [t.id, t])).values())
      setTodos(uniqueArray)
    } catch (error) {
      console.error('Error loading todos:', error)
      toast.error('Failed to load todos')
    } finally {
      setIsLoading(false)
    }
  }

  // Add new todo
  const addTodo = async () => {
    if (!newTodo.trim()) return

    try {
      setIsAddingTodo(true)
      
      // Use AI to categorize and prioritize
      const [category, priority] = await Promise.all([
        categorizeTodo(newTodo, newDescription),
        prioritizeTodo(newTodo, newDescription)
      ])

      const id = crypto.randomUUID()

      await blink.db.todos.create({
        id,
        title: newTodo,
        description: newDescription,
        category,
        priority,
        completed: false,
        user_id: user.id,
        created_at: new Date().toISOString()
      })

      const createdTodo: Todo = {
        id,
        title: newTodo,
        description: newDescription,
        category: category as Todo['category'],
        priority: priority as Todo['priority'],
        completed: false,
        user_id: user.id,
        created_at: new Date().toISOString()
      }

      // Add to state while ensuring uniqueness
      setTodos(prev => {
        const withoutDuplicate = ensureArray<Todo>(prev).filter(t => t.id !== createdTodo.id)
        return [createdTodo, ...withoutDuplicate]
      })
      setNewTodo('')
      setNewDescription('')

      toast.success(`Todo added and auto-categorized as ${category}!`)
    } catch (error) {
      console.error('Error adding todo:', error)
      toast.error('Failed to add todo')
    } finally {
      setIsAddingTodo(false)
    }
  }

  // Toggle todo completion
  const toggleTodo = async (id: string, completed: boolean) => {
    if (!id) return
    try {
      await blink.db.todos.update(id, { completed })
      setTodos(prev => prev.map(todo => 
        todo.id === id ? { ...todo, completed } : todo
      ))
      toast.success(completed ? 'Todo completed!' : 'Todo marked as incomplete')
    } catch (error) {
      console.error('Error updating todo:', error)
      toast.error('Failed to update todo')
    }
  }

  // Delete todo
  const deleteTodo = async (id: string) => {
    try {
      await blink.db.todos.delete(id)
      setTodos(prev => prev.filter(todo => todo.id !== id))
      toast.success('Todo deleted')
    } catch (error) {
      console.error('Error deleting todo:', error)
      toast.error('Failed to delete todo')
    }
  }

  // Filter todos
  const safeTodos = Array.isArray(todos) ? todos : []
  const filteredTodos = safeTodos.filter((todo: Todo) => {
    const matchesSearch = todo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         todo.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || todo.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Get stats
  const completedCount = safeTodos.filter((todo: Todo) => Number(todo.completed) > 0).length
  const totalCount = safeTodos.length
  const highPriorityCount = safeTodos.filter((todo: Todo) => todo.priority === 'high' && !(Number(todo.completed) > 0)).length

  // Auth state management
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  // Load todos when user is authenticated
  useEffect(() => {
    if (user) {
      loadTodos()
    }
  }, [user])

  // Create database table on first load
  useEffect(() => {
    if (user) {
      blink.db.sql(`
        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          category TEXT DEFAULT 'other',
          priority TEXT DEFAULT 'medium',
          completed BOOLEAN DEFAULT FALSE,
          created_at TEXT NOT NULL,
          due_date TEXT,
          user_id TEXT NOT NULL
        )
      `).catch(console.error)
    }
  }, [user])

  // Ensure todos state is always an array
  useEffect(() => {
    if (!Array.isArray(todos)) {
      setTodos([])
    }
  }, [todos])

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Smart Todo App</CardTitle>
            <p className="text-gray-600">AI-powered task organization</p>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-500 mb-4">
              Sign in to start organizing your tasks with smart categorization
            </p>
            <Button onClick={() => blink.auth.login()} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="max-w-6xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Smart Todo</h1>
          </div>
          <p className="text-gray-600">AI-powered task organization and prioritization</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
                  <p className="text-sm text-gray-600">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalCount - completedCount}</p>
                  <p className="text-sm text-gray-600">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{highPriorityCount}</p>
                  <p className="text-sm text-gray-600">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Todo Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                placeholder="What needs to be done?"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && addTodo()}
                className="text-lg"
              />
              <Input
                placeholder="Add description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && addTodo()}
              />
              <Button 
                onClick={addTodo} 
                disabled={!newTodo.trim() || isAddingTodo}
                className="w-full"
              >
                {isAddingTodo ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-spin" />
                    AI is categorizing...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Task
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search todos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('all')}
                  size="sm"
                >
                  All
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory(cat.id)}
                    size="sm"
                  >
                    <cat.icon className="w-4 h-4 mr-1" />
                    {cat.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Todos List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your tasks...</p>
            </div>
          ) : filteredTodos.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'No matching tasks found' 
                  : 'No tasks yet. Add your first task above!'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredTodos.map((todo) => {
                const category = categories.find(cat => cat.id === todo.category)
                const priority = priorities.find(p => p.id === todo.priority)
                
                return (
                  <motion.div
                    key={todo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className={`transition-all duration-200 hover:shadow-md ${
                      Number(todo.completed) > 0 ? 'opacity-60 bg-gray-50' : ''
                    }`}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={Number(todo.completed) > 0}
                            onCheckedChange={(checked) => toggleTodo(todo.id, checked as boolean)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className={`font-medium ${
                                Number(todo.completed) > 0 ? 'line-through text-gray-500' : 'text-gray-900'
                              }`}>
                                {todo.title}
                              </h3>
                              {todo.priority === 'high' && (
                                <Star className="w-4 h-4 text-red-500 fill-red-500" />
                              )}
                            </div>
                            
                            {todo.description && (
                              <p className={`text-sm mb-3 ${
                                Number(todo.completed) > 0 ? 'line-through text-gray-400' : 'text-gray-600'
                              }`}>
                                {todo.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2 flex-wrap">
                              {category && (
                                <Badge className={category.color}>
                                  <category.icon className="w-3 h-3 mr-1" />
                                  {category.name}
                                </Badge>
                              )}
                              {priority && (
                                <Badge variant="outline" className={priority.color}>
                                  {priority.name}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">
                                {new Date(todo.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTodo(todo.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}

export default App