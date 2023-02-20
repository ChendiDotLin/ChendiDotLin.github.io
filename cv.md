---
layout: page
---


<style>
    .pdf-container {
        position: relative;
        width: 100%;
        padding-bottom: 56.25%; /* 16:9 aspect ratio */
        margin-bottom: 20px;
    }
    .pdf-container object, embed { 
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }
    @media (max-width: 480px) {
    .pdf-container {
        width: 80%;
    }
}
</style>

<div class="pdf-container">
    <object data="/resume/2023_Resume_for_SDE.pdf" type="application/pdf">
        <embed src="/resume/2023_Resume_for_SDE.pdf">
            <p>This browser does not support PDFs. Please download the PDF to view it: <a href="/resume/2023_Resume_for_SDE.pdf">Download PDF</a>.</p>
        </embed>
    </object>
</div>
