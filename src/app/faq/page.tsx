"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<number[]>([]);

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
      question: "Are students listed alphabetically?",
      answer: "Yes, they are alphabetical by first name."
    },
    {
      question: "Can I delete a student if they withdraw from my class?",
      answer: "Yes, however, once deleted, all records and data for that student will also be deleted and you will not be able to run reports for that student."
    },
    {
      question: "How can I make suggestions or request for a new feature?",
      answer: "Send us an email using contact us. We review every suggestion in depth. When we add a new feature, you will be notified."
    },
    {
      question: "Does my subscription include new features and updates?",
      answer: "Updates are included with your subscription. New features may or may not be included. Based on the degree of difficulty and time needed to create a new feature would determine if there were an additional charge. If you are subscribed and there is a new feature released, you would only pay an additional charge and would not need to purchase a full subscription."
    }
  ];

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-900">Frequently Asked Questions</CardTitle>
            <p className="text-gray-600 mt-2">Find answers to common questions about My Class Log</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => toggleItem(index)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <h3 className="text-lg font-medium text-gray-900 pr-4">
                      {faq.question}
                    </h3>
                    {openItems.includes(index) ? (
                      <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                  {openItems.includes(index) && (
                    <div className="px-6 pb-4">
                      <p className="text-gray-700 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Still have questions?</h3>
              <p className="text-blue-700 mb-4">
                Can't find what you're looking for? We're here to help!
              </p>
              <div className="bg-white p-4 rounded-lg">
                <p className="font-medium text-gray-800">Contact Us</p>
                <p className="text-gray-600">Email: admin@myclasslog.com</p>
                <p className="text-sm text-gray-500 mt-2">
                  We typically respond within 24 hours
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 