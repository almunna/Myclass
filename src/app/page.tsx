"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Clock, 
  BarChart3, 
  FileText, 
  CheckCircle, 
  ArrowRight,
  Calendar,
  UserCheck,
  Download,
  Edit,
  Shield,
  Star,
  Zap,
  ChevronDown,
  ChevronUp,
  HelpCircle
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export default function LandingPage() {
  const { currentUser } = useAuth();
  const [openFaqItems, setOpenFaqItems] = useState<number[]>([]);

  const toggleFaqItem = (index: number) => {
    setOpenFaqItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const faqs = [
    {
      question: "Am I limited to how many students I can have?",
      answer: "No, you can upload or add as many students as you want."
    },
    {
      question: "Am I limited to how many periods I can have?",
      answer: "No, you can create as many periods as you want."
    },
    {
      question: "I have a student that I have in 2 different class periods, can My Class Log accommodate this?",
      answer: "Yes. You can add a student to as many periods as you need."
    },
    {
      question: "What information is required to add or upload students?",
      answer: "The only information required is the students' first and last name and what period or periods they are in. Student ID and Grade are optional and are not required."
    },
    {
      question: "Can a student's ID contain numbers and or text?",
      answer: "Yes, the ID can be all numbers, all letters, or a combination of both."
    },
    {
      question: "How does the attendance tracking feature work?",
      answer: "Our attendance system lets you easily mark students as Present, Tardy, or Absent with just a click. You can take attendance for any date, edit past records, and generate detailed reports by date range, period, or individual student. The system automatically saves your data and provides visual summaries."
    },
    {
      question: "Does my subscription include new features and updates?",
      answer: "Updates are included with your subscription. New features may or may not be included. Based on the degree of difficulty and time needed to create a new feature would determine if there were an additional charge."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">

            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Effortless Student
              <span className="text-blue-600 block">Tracking & Management</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Streamline your classroom with powerful tools for daily attendance tracking, student management, 
              room exit monitoring, and comprehensive reporting. Save time and stay organized.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {currentUser ? (
                <Link href="/dashboard">
                  <Button size="lg" className="text-lg px-8 py-6">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                                  <>
                    <Link href="/signup">
                      <Button size="lg" className="text-lg px-8 py-6">
                        Get Started
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                    <Link href="#features">
                      <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                        See Features
                      </Button>
                    </Link>
                  </>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Get started in under 2 minutes
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Manage Your Classroom
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed by teachers, for teachers. Simplify your daily workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Student Management */}
            <Card className="border-2 hover:border-blue-200 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Smart Student Management</CardTitle>
                <CardDescription>
                  Organize students across multiple school years and periods with advanced filtering and search.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Hierarchical school year organization
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Multiple periods per student
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Advanced filtering by year & period
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Room Exit Tracking */}
            <Card className="border-2 hover:border-blue-200 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Room Exit Tracking</CardTitle>
                <CardDescription>
                  Track when students leave and return with precise timestamps and duration calculations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Real-time exit/return tracking
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Automatic duration calculation
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Edit times after completion
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Time Editing */}
            <Card className="border-2 hover:border-blue-200 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Edit className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Flexible Time Editing</CardTitle>
                <CardDescription>
                  Forgot to mark a student back in? Easily edit exit and return times with intuitive controls.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Quick time adjustment buttons
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    User-friendly interface
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Real-time duration updates
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Advanced Reports & Analytics */}
            <Card className="border-2 hover:border-blue-200 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle>Advanced Reports & Analytics</CardTitle>
                <CardDescription>
                  Comprehensive reporting with multi-level filtering by school year, period, and student.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    School year & period filtering
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Export to CSV with full data
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Interactive charts & visualizations
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Attendance Management */}
            <Card className="border-2 hover:border-blue-200 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <UserCheck className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle>Comprehensive Attendance Management</CardTitle>
                <CardDescription>
                  Take daily attendance with ease. Track Present, Tardy, and Absent students with powerful reporting features.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Interactive attendance interface
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Present/Tardy/Absent tracking
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Detailed attendance reports & analytics
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Edit past attendance records
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Hierarchical Organization */}
            <Card className="border-2 hover:border-blue-200 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Calendar className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle>Hierarchical Organization</CardTitle>
                <CardDescription>
                  Organize with school years at the top level, containing class periods for complete structure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    School year containers (e.g., "2024-2025")
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Nested class periods per year
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Multi-level filtering & grouping
                  </li>
                </ul>
              </CardContent>
            </Card>


          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Why Teachers Love MyClassLog
            </h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto">
              Join other educators who have transformed their classroom management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Save Time</h3>
              <p className="text-blue-100">
                Reduce administrative tasks by 70%. Spend more time teaching, less time on paperwork.
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Better Insights</h3>
              <p className="text-blue-100">
                Understand student patterns and behaviors with detailed analytics and reporting.
              </p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Stay Organized</h3>
              <p className="text-blue-100">
                Keep all student data secure, organized, and easily accessible from anywhere.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Simple, Affordable Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Choose the plan that works for you
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Plan */}
            <Card className="border-2 border-gray-200 hover:border-blue-300 transition-colors">
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Monthly Plan</CardTitle>
                <CardDescription>Perfect for getting started</CardDescription>
                <div className="text-3xl font-bold text-gray-900 mt-4">$1.50</div>
                <div className="text-gray-500">per month</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Unlimited students</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Daily attendance tracking & reports</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Room exit monitoring</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Export data (CSV)</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Multi-class management</span>
                  </li>
                </ul>
                <Link href="/subscription" className="w-full block">
                  <Button className="w-full" variant="outline">
                    Choose Monthly
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Annual Plan */}
            <Card className="border-2 border-blue-500 relative hover:border-blue-600 transition-colors">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-500 text-white px-3 py-1">
                  Best Value
                </Badge>
              </div>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Annual Plan</CardTitle>
                <CardDescription>Save money with yearly billing</CardDescription>
                <div className="text-3xl font-bold text-gray-900 mt-4">$7.99</div>
                <div className="text-gray-500">per year</div>
                <div className="text-sm text-green-600 font-medium mt-1">
                  Save $10/year vs monthly
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Unlimited students</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Daily attendance tracking & reports</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Room exit monitoring</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Export data (CSV)</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-3" />
                    <span>Multi-class management</span>
                  </li>
                </ul>
                <Link href="/subscription" className="w-full block">
                  <Button className="w-full">
                    Choose Annual
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-gray-600">
              Cancel anytime • Secure payments
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get answers to common questions about My Class Log
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <Card key={index} className="border border-gray-200 hover:border-blue-300 transition-colors">
                  <button
                    onClick={() => toggleFaqItem(index)}
                    className="w-full text-left cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <CardTitle className="text-lg font-medium text-gray-900 pr-4">
                        {faq.question}
                      </CardTitle>
                      {openFaqItems.includes(index) ? (
                        <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      )}
                    </CardHeader>
                  </button>
                  {openFaqItems.includes(index) && (
                    <CardContent className="pt-0">
                      <p className="text-gray-700 leading-relaxed">
                        {faq.answer}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
            
            <div className="mt-12 text-center">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-8">
                  <h3 className="text-xl font-semibold text-blue-900 mb-3">
                    Still have questions?
                  </h3>
                  <p className="text-blue-700 mb-6">
                    Can't find what you're looking for? We're here to help!
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <div className="text-center">
                      <p className="font-medium text-gray-800">Contact Us</p>
                      <p className="text-gray-600">admin@myclasslog.com</p>
                    </div>
                    <span className="hidden sm:block text-gray-400">•</span>
                    <Link href="/faq">
                      <Button variant="outline" className="bg-white">
                        View All FAQs
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Ready to Transform Your Classroom?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Join other teachers who are already saving time and staying organized with MyClassLog.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {currentUser ? (
                <Link href="/dashboard">
                  <Button size="lg" className="text-lg px-8 py-6">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                                  <>
                    <Link href="/signup">
                      <Button size="lg" className="text-lg px-8 py-6">
                        Get Started Today
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="outline" size="lg" className="text-lg px-8 py-6">
                        Sign In
                      </Button>
                    </Link>
                  </>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Join today • Cancel anytime • Secure payment
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">MyClassLog</span>
            </div>
            <div className="flex flex-wrap gap-4 justify-center md:justify-end text-sm text-gray-400">
              <Link href="/login" className="hover:text-white transition-colors">
                Sign In
              </Link>
              <Link href="/signup" className="hover:text-white transition-colors">
                Sign Up
              </Link>
              <Link href="/faq" className="hover:text-white transition-colors">
                FAQ
              </Link>
              <Link href="/privacy-policy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms-of-service" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
              <span className="w-full md:w-auto text-center md:text-left">© 2024 MyClassLog. All rights reserved.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
