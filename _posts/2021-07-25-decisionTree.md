---
layout: post
title: Decision Tree (DT)
subtitle: Knowledge Sharing
comments: true
---
## What is Decision Tree and Why Do We Want to Use It?
You can treat decision tree as a function approximator, which takes in an input with $n$ attributes $\vec{x} \in \mathcal{R}^n$, and outputs a result $y$. For example, 
<p align="center">
<img src="/knowledge/decisionTree/DTexample.png" width="60%">
</p>

*<center>taken from CMU 10601 lecture note</center>*

In the dataset shown above, if the weather is sunny and the temperature is hot, the tennis event is always canceled. Thus, if we are given a new input in the future with sunny weather and hot temperature, these two attributes should inform our trained decision tree that, the tennis is unlikely to happen today either.

We can see from this example that, one of the biggest advantages of DT is its straightforwardness. The learning process is super intuitive and friendly to the people without machine learning knowledge. Also, because of the tree structure, the computation and memory are efficient. Moreover, this method can be widely used in various problems including classification, regression, etc.

## How to Decide Which Attribute We Should Used
In the example above, though there are four attributes presented, they are not equally critical to our problem. Actually, using all the provided attributes can normally lead to over-fitting issues. To build a decision tree, we usually want to start from the most important attribute, i.e., the attribute that reveals the most information. To find out which attribute yields the best classifier, the following four concepts in information theory need to be discussed: entropy, specific conditional entropy, conditional entropy, and mutual information.
### Entropy
Entropy is calculated as

$$H(Y) = -\sum_{i=1}^nP(Y= i)\log_2P(Y = i)$$

Notice that, when $P(Y = i) = 0$, $\log_2P(Y = i)$ is not defined. In this case, $P(Y= i)\log_2P(Y = i)$ is specified as 0. To understand this equation, let's take a look at the textbook.

*One interpretation of entropy from information theory is that it specifies the minimum number of bits of information needed to encode the classification of an arbitrary member of S (i.e., a member of S drawn at random with uniform probability). — Page 58, Machine Learning, 1997.*

My interpretation of entropy is that this term describes how well the data is uniformly distributed in the dataset. For example, if $Y$ can only either be $a$ or $b$, and their appearance frequencies are the same, i.e., 

$$P(Y= a) = P(Y = b)$$

then we have

$$\begin{align}
H(Y) &= -P(Y= a)\log_2P(Y = a) - P(Y= b)\log_2P(Y = b)\\
    &= -0.5*(-1) - 0.5 * (-1) = 1
\end{align}$$

So the entropy is maximized and the distribution is pretty uniform. However, if $Y = a$ throughout the whole dataset, then the entropy becomes

$$\begin{align}
H(Y) &= -P(Y= a)\log_2P(Y = a) - P(Y= b)\log_2P(Y = b)\\
    &= -1*(0) - 0 = 0
\end{align}$$

which means the data is pretty polarized.